export type SaveStatus = 'accepted' | 'saved' | 'error' | 'conflict';
export type SaveResult = { sessionId: string; noteId: string; sequence: number; status: SaveStatus; message?: string };
export type SaveSession = {
 id: string; noteId: string; baseBody: string; body: string; sequence: number;
 savedSequence: number; pending: boolean; blocked: boolean; status: SaveStatus; message?: string;
};

/** Shared across editor views: writes to one note are always serialized. */
export class SaveCoordinator {
 private sessions = new Map<string, SaveSession>();
 private lanes = new Map<string, Promise<void>>();
 private nextId = 0;
 constructor(private read: (noteId: string) => Promise<string>,
  private write: (session: SaveSession, body: string) => Promise<void>,
  private notify: (result: SaveResult) => void) {}

 open(noteId: string, body: string): SaveSession {
  const session: SaveSession = { id: `session-${++this.nextId}`, noteId, baseBody: body, body,
   sequence: 0, savedSequence: 0, pending: false, blocked: false, status: 'saved' };
  this.sessions.set(session.id, session);
  return session;
 }
 get(id: string): SaveSession | undefined { return this.sessions.get(id); }
 private report(session: SaveSession, status: SaveStatus, sequence = session.sequence, message?: string): void {
  session.status = status; session.message = message;
  this.notify({ sessionId: session.id, noteId: session.noteId, sequence, status, message });
 }
 submit(id: string, sequence: number, baseBody: string, body: string): boolean {
  const session = this.sessions.get(id);
  if (!session || !Number.isSafeInteger(sequence) || sequence <= session.sequence) return false;
  // The session token binds the initial content; accepted writes advance baseBody internally.
  if (baseBody !== session.baseBody && session.sequence === 0) return false;
  session.sequence = sequence; session.body = body;
  if (!session.blocked) { this.report(session, 'accepted'); this.schedule(session); }
  else this.report(session, session.status, sequence, session.message);
  return true;
 }
 retry(id: string): boolean {
  const session = this.sessions.get(id);
  if (!session || session.status === 'conflict') return false;
  session.blocked = false; this.report(session, 'accepted'); this.schedule(session); return true;
 }
 async settled(noteId: string): Promise<void> {
  while (this.lanes.has(noteId)) await this.lanes.get(noteId);
 }
 private schedule(session: SaveSession): void {
  if (session.pending || session.blocked) return;
  session.pending = true;
  const previous = this.lanes.get(session.noteId) || Promise.resolve();
  const task = previous.then(async () => {
   try {
    while (!session.blocked && session.savedSequence < session.sequence) {
     const sequence = session.sequence;
     const body = session.body;
     const current = await this.read(session.noteId);
     if (current !== session.baseBody) {
      session.blocked = true;
      this.report(session, 'conflict', session.sequence, 'This note changed outside this editing session. Save a copy or reload the note.');
      break;
     }
     await this.write(session, body);
     session.baseBody = body;
     session.savedSequence = sequence;
     if (sequence === session.sequence) this.report(session, 'saved', sequence);
    }
   } catch (error) {
    session.blocked = true;
    this.report(session, 'error', session.sequence, error instanceof Error ? error.message : 'Could not save the board.');
   } finally { session.pending = false; }
  });
  this.lanes.set(session.noteId, task);
  void task.then(() => { if (this.lanes.get(session.noteId) === task) this.lanes.delete(session.noteId); });
 }
}
