// Module-level flags for the "data-dir migration → restart required" flow.
//
// Both flags are intentionally non-persistent: the process restart that the
// user is asked to perform also wipes the module state, so the next boot
// starts clean (maintenance=false, restartRequired=false). The new dataDir
// is what *persists* — via the pointer file in dataDirPointer.ts.

let _maintenance = false;
let _maintenanceMessage: string | null = null;
let _restartRequired = false;
let _restartReason: string | null = null;
let _restartTargetDir: string | null = null;

export function isMaintenance(): boolean {
  return _maintenance;
}

export function getMaintenanceMessage(): string | null {
  return _maintenance ? _maintenanceMessage : null;
}

export function setMaintenance(on: boolean, message: string | null = null): void {
  _maintenance = on;
  _maintenanceMessage = on ? message : null;
}

export function isRestartRequired(): boolean {
  return _restartRequired;
}

export function getRestartInfo(): { reason: string | null; targetDir: string | null } {
  return { reason: _restartReason, targetDir: _restartTargetDir };
}

export function setRestartRequired(
  on: boolean,
  reason: string | null = null,
  targetDir: string | null = null
): void {
  _restartRequired = on;
  _restartReason = on ? reason : null;
  _restartTargetDir = on ? targetDir : null;
}
