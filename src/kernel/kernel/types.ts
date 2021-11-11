export enum KernelContext {
  User,
  Priveleged,
}

export enum KernelFlags {
  PRIVILEGED = 0,
  USER = 1,
  WORKER = 2,
  WORKER_PROXY = 4,
  UI = 8,
  SERVICE_WORKER = 16,
  DISABLE_NET = 32,
  BOOTLOADER = 64,
  MAIN = 128,
}
