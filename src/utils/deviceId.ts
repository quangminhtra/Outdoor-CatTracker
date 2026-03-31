const DEVICE_ID_PATTERN = /^RAK-\d{3}$/;

export function normalizeDeviceId(value: string) {
  return value.trim().toUpperCase();
}

export function isValidDeviceId(value: string) {
  return DEVICE_ID_PATTERN.test(normalizeDeviceId(value));
}

export function getDeviceIdValidationError(value: string) {
  const normalized = normalizeDeviceId(value);

  if (!normalized) {
    return "Enter the tracker device ID.";
  }

  if (!DEVICE_ID_PATTERN.test(normalized)) {
    return "Device ID must match the format RAK-001.";
  }

  return null;
}
