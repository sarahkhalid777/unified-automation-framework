// Separate error types so a report can tell "framework/environment problem" apart from "application bug".
export class FrameworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends FrameworkError {}

export class EnvironmentUnavailableError extends FrameworkError {}
