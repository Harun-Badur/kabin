export const INVITE_SHARE_HEADLINE =
  "Kabin'de kıyafetleri üzerinde dene! 🎽";

export const buildInviteShareMessage = (storeUrl: string): string =>
  `${INVITE_SHARE_HEADLINE}\n${storeUrl}`;
