-- Fix foreign key constraint for duplicate_of to SET NULL on delete
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_duplicate_of_fkey;

ALTER TABLE receipts 
ADD CONSTRAINT receipts_duplicate_of_fkey 
FOREIGN KEY (duplicate_of) REFERENCES receipts(id) 
ON DELETE SET NULL;

-- Fix email_attachments foreign key as well
ALTER TABLE email_attachments DROP CONSTRAINT IF EXISTS email_attachments_receipt_id_fkey;

ALTER TABLE email_attachments 
ADD CONSTRAINT email_attachments_receipt_id_fkey 
FOREIGN KEY (receipt_id) REFERENCES receipts(id) 
ON DELETE SET NULL;