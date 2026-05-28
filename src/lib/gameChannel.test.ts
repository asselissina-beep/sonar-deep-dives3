import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTROLLER_INPUT_INTERVAL_MS,
  CONTROLLER_MAX_INPUT_HZ,
  REMOTE_JOYSTICK_DEADZONE,
  SESSION_CODE_CHARS,
  SESSION_CODE_LENGTH,
  buildControllerUrl,
  channelNameForSession,
  controllerInputsEqual,
  generateJoinToken,
  generateSessionCode,
  isMeaningfulControllerInput,
  isValidJoinToken,
  isValidSessionCode,
  messageHasJoinToken,
} from "@/lib/gameChannel";

describe("controller input rate", () => {
  it("caps broadcasts at ~30 Hz", () => {
    expect(CONTROLLER_MAX_INPUT_HZ).toBe(30);
    expect(CONTROLLER_INPUT_INTERVAL_MS).toBe(33);
  });
});

describe("generateSessionCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a code of the configured length", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const code = generateSessionCode();
    expect(code).toHaveLength(SESSION_CODE_LENGTH);
    expect(code).toBe(SESSION_CODE_CHARS[0].repeat(SESSION_CODE_LENGTH));
  });

  it("uses only allowed characters", () => {
    const allowed = new Set(SESSION_CODE_CHARS);
    for (let i = 0; i < 40; i++) {
      vi.spyOn(Math, "random").mockReturnValue((i % SESSION_CODE_CHARS.length) / SESSION_CODE_CHARS.length);
      for (const char of generateSessionCode()) {
        expect(allowed.has(char)).toBe(true);
      }
      vi.restoreAllMocks();
    }
  });
});

describe("generateJoinToken", () => {
  it("returns a 32-char lowercase hex string", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        arr.fill(0xab);
        return arr;
      },
    });
    expect(generateJoinToken()).toBe("ab".repeat(16));
    vi.unstubAllGlobals();
  });
});

describe("session code validation", () => {
  it("accepts valid codes case-insensitively", () => {
    expect(isValidSessionCode("k7w3np")).toBe(true);
    expect(isValidSessionCode("K7W3NP")).toBe(true);
  });

  it("rejects invalid codes", () => {
    expect(isValidSessionCode("ABC")).toBe(false);
    expect(isValidSessionCode("ABCDEFG")).toBe(false);
    expect(isValidSessionCode("ABCDEF1")).toBe(false); // 1 not in charset
  });
});

describe("join token validation", () => {
  it("accepts 32 hex chars", () => {
    expect(isValidJoinToken("a".repeat(32))).toBe(true);
  });

  it("rejects wrong length or charset", () => {
    expect(isValidJoinToken("short")).toBe(false);
    expect(isValidJoinToken("g".repeat(32))).toBe(false);
  });
});

describe("buildControllerUrl", () => {
  it("builds normalized query params", () => {
    const url = buildControllerUrl("https://booth.example", "k7w3np", "A".repeat(32));
    expect(url).toBe(
      `https://booth.example/controller?session=K7W3NP&token=${"a".repeat(32)}`
    );
  });
});

describe("channelNameForSession", () => {
  it("prefixes and uppercases session code", () => {
    expect(channelNameForSession("k7w3np")).toBe("abyssal_session_K7W3NP");
  });
});

describe("isMeaningfulControllerInput", () => {
  const idle = {
    joystickX: 0,
    joystickY: 0,
    thrust: false,
    fire: false,
    sonar: false,
    restart: false,
  };

  it("is false when idle", () => {
    expect(isMeaningfulControllerInput(idle)).toBe(false);
  });

  it("is true for joystick, buttons, or restart", () => {
    expect(isMeaningfulControllerInput({ ...idle, joystickX: REMOTE_JOYSTICK_DEADZONE + 0.1 })).toBe(true);
    expect(isMeaningfulControllerInput({ ...idle, joystickX: REMOTE_JOYSTICK_DEADZONE * 0.5 })).toBe(false);
    expect(isMeaningfulControllerInput({ ...idle, fire: true })).toBe(true);
    expect(isMeaningfulControllerInput({ ...idle, restart: true })).toBe(true);
  });
});

describe("controllerInputsEqual", () => {
  it("compares all input fields", () => {
    const a = {
      joystickX: 1,
      joystickY: 0,
      thrust: true,
      fire: false,
      sonar: false,
      restart: false,
    };
    expect(controllerInputsEqual(a, { ...a })).toBe(true);
    expect(controllerInputsEqual(a, { ...a, fire: true })).toBe(false);
  });
});

describe("messageHasJoinToken", () => {
  it("includes player_joined and controller_input", () => {
    expect(
      messageHasJoinToken({
        type: "player_joined",
        playerName: "P",
        joinToken: "t",
      })
    ).toBe(true);
    expect(
      messageHasJoinToken({
        type: "controller_input",
        joinToken: "t",
        joystickX: 0,
        joystickY: 0,
        thrust: false,
        fire: false,
        sonar: false,
        restart: false,
        playerName: "P",
      })
    ).toBe(true);
  });

  it("requires joinToken on player_left", () => {
    expect(messageHasJoinToken({ type: "player_left" })).toBe(false);
    expect(
      messageHasJoinToken({ type: "player_left", joinToken: "abc" })
    ).toBe(true);
  });
});
