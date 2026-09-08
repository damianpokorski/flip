import type { WorkspaceData } from "./api";

export function workspaceLabel(workspaces: WorkspaceData[], ws: string): string {
  return workspaces.find((workspace) => workspace.id === ws)?.label ?? ws;
}
