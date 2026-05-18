export interface CurrentSessionResponse {
  device: string;
  ipMasked: string;
  signedInAt: string | null;
}

export interface SignOutOthersResponse {
  signedOutAt: string;
}
