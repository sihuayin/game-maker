import type { CreationStore } from "./store.js";

export class InMemoryCreationStore implements CreationStore {
  projects = new Map();
  runs = new Map();
  artifacts = new Map();
  checkpoints = new Map();
  observations = new Map();
  evaluations = new Map();
  repairs = new Map();
}
