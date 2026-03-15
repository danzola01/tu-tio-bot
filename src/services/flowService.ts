import { GameMode } from "./mapService.js";

export interface MatchFlowState {
  squad: string[];
  mode?: GameMode;
  map?: string;
}

export class FlowService {
  private states = new Map<string, MatchFlowState>();

  get(key: string): MatchFlowState | undefined {
    return this.states.get(key);
  }

  set(key: string, state: MatchFlowState): void {
    this.states.set(key, state);
  }

  delete(key: string): void {
    this.states.delete(key);
  }

  getOrCreate(key: string, initialUserId: string): MatchFlowState {
    let state = this.states.get(key);
    if (!state) {
      state = { squad: [initialUserId] };
      this.states.set(key, state);
    }
    return state;
  }
}
