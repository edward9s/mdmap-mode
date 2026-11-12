import { Notice, Platform } from "obsidian";

const BRIDGE_URL = "http://127.0.0.1:8787";
const MAX_PLAY_BYTES = 1024 * 1024;
const MAX_PLAY_CHUNKS = 10_000;

type Engine = "none" | "web" | "android";
type BridgeStatus = {
	session: number;
	state: "none" | "starting" | "playing" | "paused" | "ended" | "stopped";
	index: number;
};
type BridgeHealth = {
	ok: boolean;
	version: number;
	ttsReady: boolean;
	play: boolean;
	busy: boolean;
};

// Both Web Speech and the Android bridge are singleton playback resources.
let activeReader: BranchSpeech | null = null;

/** A small, cancelable playback controller; it never modifies a note. */
export class BranchSpeech {
	private engine: Engine = "none";
	private generation = 0;
	private session: number | null = null;
	private bridgeToken: string | null = null;
	private timer: number | null = null;

	private readonly onChange: () => void;

	constructor(onChange: () => void) {
		this.onChange = onChange;
	}

	get active(): boolean {
		return this.engine !== "none";
	}

	async toggle(groups: string[], bridgeToken: string | null): Promise<void> {
		if (this.active) {
			this.stop();
			return;
		}
		if (groups.length === 0) {
			new Notice("There are no readable nodes.");
			return;
		}

		if (Platform.isAndroidApp && !bridgeToken) {
			new Notice("Android narration needs Read Me Offline. Pair it with mdmap mode using the command palette.");
			return;
		}

		activeReader?.stop();
		activeReader = this;
		const generation = ++this.generation;
		this.engine = Platform.isAndroidApp ? "android" : "web";
		this.bridgeToken = bridgeToken;
		this.onChange();
		try {
			if (this.engine === "android") {
				await this.startAndroid(groups, bridgeToken as string, generation);
			} else {
				this.startWeb(groups, generation);
			}
		} catch (error) {
			if (generation !== this.generation) return;
			this.finish();
			const message = error instanceof Error ? error.message : "Unknown speech error";
			new Notice(`Unable to read aloud: ${message}`);
		}
	}

	stop(): void {
		const engine = this.engine;
		const session = this.session;
		const token = this.bridgeToken;
		++this.generation;
		this.finish();
		if (engine === "web") window.speechSynthesis?.cancel();
		if (engine === "android" && session !== null && token) {
			void this.controlAndroid(session, token).catch(() => {
				new Notice("Unable to stop Android narration. Use Read Me Offline's media controls.");
			});
		}
	}

	private finish(): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
		this.session = null;
		this.bridgeToken = null;
		this.engine = "none";
		if (activeReader === this) activeReader = null;
		this.onChange();
	}

	private startWeb(groups: string[], generation: number): void {
		const synth = window.speechSynthesis;
		if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
			throw new Error("This device does not provide speech synthesis.");
		}
		let index = 0;
		const speakNext = (): void => {
			if (generation !== this.generation) return;
			if (index === groups.length) {
				this.finish();
				return;
			}
			const utterance = new SpeechSynthesisUtterance(groups[index++]);
			utterance.lang = "zh-TW";
			utterance.onend = () => speakNext();
			utterance.onerror = (event) => {
				if (generation !== this.generation) return;
				this.finish();
				new Notice(`Speech synthesis failed: ${event.error}`);
			};
			synth.speak(utterance);
		};
		synth.cancel();
		speakNext();
	}

	private async startAndroid(groups: string[], token: string, generation: number): Promise<void> {
		const healthResponse = await fetch(`${BRIDGE_URL}/health`);
		if (!healthResponse.ok) throw new Error("Read Me Offline bridge is not responding.");
		const health = await healthResponse.json() as BridgeHealth;
		if (health.version !== 1 || !health.play) {
			throw new Error("Read Me Offline bridge does not support playback.");
		}
		if (!health.ttsReady || health.busy) {
			throw new Error("Read Me Offline is unavailable or already playing.");
		}
		if (generation !== this.generation) return;

		if (groups.length > MAX_PLAY_CHUNKS) throw new Error("Too many reading groups.");
		const body = groups.join("\u001e");
		if (new TextEncoder().encode(body).byteLength > MAX_PLAY_BYTES) {
			throw new Error("The selected branch is too large for Android playback.");
		}

		const response = await fetch(`${BRIDGE_URL}/play?rate=1.0`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "text/plain; charset=utf-8",
			},
			body,
		});
		if (!response.ok) {
			if (response.status === 401) throw new Error("Read Me Offline pairing token was rejected.");
			throw new Error(`Read Me Offline returned HTTP ${response.status}.`);
		}
		const result = await response.json() as { session: number };
		if (!Number.isInteger(result.session) || result.session <= 0) {
			throw new Error("Read Me Offline returned an invalid playback session.");
		}
		if (generation !== this.generation) {
			await this.controlAndroid(result.session, token);
			return;
		}
		this.session = result.session;
		this.pollAndroid(generation, token);
	}

	private pollAndroid(generation: number, token: string): void {
		if (generation !== this.generation) return;
		this.timer = window.setTimeout(() => {
			void (async () => {
				try {
					const response = await fetch(`${BRIDGE_URL}/status`, {
						headers: { Authorization: `Bearer ${token}` },
					});
					if (!response.ok) throw new Error("Playback status unavailable.");
					const status = await response.json() as BridgeStatus;
					if (generation !== this.generation) return;
					if (status.session !== this.session || ["none", "ended", "stopped"].includes(status.state)) {
						this.finish();
					} else {
						this.pollAndroid(generation, token);
					}
				} catch {
					if (generation === this.generation) this.stop();
				}
			})();
		}, 1000);
	}

	private async controlAndroid(session: number, token: string): Promise<void> {
		const response = await fetch(
			`${BRIDGE_URL}/control?action=stop&session=${session}`,
			{
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
			},
		);
		if (!response.ok && response.status !== 409) {
			throw new Error("Read Me Offline could not stop playback.");
		}
	}
}
