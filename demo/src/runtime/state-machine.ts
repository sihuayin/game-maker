import type { CreationStatus } from "../contracts/index.js";

const transitions: Record<CreationStatus, CreationStatus[]> = {
  created:["compiling"], compiling:["compiled","failed","cancelled"], compiled:["generating"],
  generating:["generated","failed","cancelled"], generated:["building"], building:["built","failed","cancelled"],
  built:["running"], running:["evaluating","failed","cancelled"], evaluating:["finalizing","repairing","failed"],
  repairing:["building","failed","cancelled"], finalizing:["passed","failed"],
  passed:[], failed:[], cancelled:[]
};

export function canTransition(from: CreationStatus, to: CreationStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: CreationStatus, to: CreationStatus): void {
  if (!canTransition(from,to)) throw new Error(`Invalid creation state transition: ${from} -> ${to}`);
}
