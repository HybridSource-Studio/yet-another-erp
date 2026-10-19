// Keys of the local-only meta table: this device's settings and bookkeeping. Never exported or
// merged (a backup file carries records only).

export const META_DEVICE = "deviceId";
export const META_WORKSPACE = "workspaceId";
export const META_SCHEMA = "schemaVersion";
export const META_LOCAL_FIELDS = "localFieldsVersion";
export const META_CLOCK = "clock";
/** Writes since the last backup; will drive backup reminders. */
export const META_CHANGES = "changesSinceExport";
