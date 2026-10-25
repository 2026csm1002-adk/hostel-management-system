// What the STUDENT reads for each stage of a room-swap request (the caretaker and warden screens keep
// their own wording). The stored status values stay as they are.
const LABELS: Record<string, string> = {
  Pending: "Under review by caretaker",
  Forwarded: "Forwarded · under review by warden",
  Accepted: "Accepted by warden",
  AwaitingRoom: "Accepted · waiting for a room",
  RoomAssigned: "Room assigned",
  Rejected: "Rejected",
  Waiting: "Accepted · on the waiting list for a room",
};

export function swapStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}
