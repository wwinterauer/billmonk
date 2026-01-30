export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ReceiptTag {
  id: string;
  receipt_id: string;
  tag_id: string;
  created_at: string;
}

export interface TagWithAssignment extends Tag {
  isAssigned: boolean;      // Ist dieser Tag dem aktuellen Receipt zugewiesen?
  assignmentCount?: number; // Für Bulk: Wie viele der ausgewählten Receipts haben diesen Tag?
}

export type CreateTagInput = Pick<Tag, 'name' | 'color'> & Partial<Pick<Tag, 'is_active' | 'sort_order'>>;

export type UpdateTagInput = Partial<Pick<Tag, 'name' | 'color' | 'is_active' | 'sort_order'>>;
