export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
export interface NoteInput {
  title: string;
  content: string;
}
