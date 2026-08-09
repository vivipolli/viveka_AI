export const PRIMARY_SOURCE_TYPES = ["pdf", "citation", "transcript"] as const;

export type PrimarySourceType = (typeof PRIMARY_SOURCE_TYPES)[number];

export function isPrimarySourceType(type: string): type is PrimarySourceType {
  return (PRIMARY_SOURCE_TYPES as readonly string[]).includes(type);
}

export function isStoryType(type: string): boolean {
  return type === "story";
}
