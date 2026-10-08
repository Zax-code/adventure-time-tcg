// Read-only replay of the canonical combat event journal.
export {
  applyEventsToState,
  getEventsForTurn,
  getEventsUpToTurn,
  getTotalTurns,
  getTurnSummary,
  groupEventsByTurn,
  type ApplyEventResult,
  type TurnEvents,
} from "./combat/replay";
