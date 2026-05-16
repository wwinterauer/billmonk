
-- 1) Unmark 22 false positives
UPDATE public.receipts
SET is_duplicate = false,
    duplicate_of = NULL,
    duplicate_score = NULL,
    duplicate_checked_at = now()
WHERE id IN (
  -- Different invoice numbers
  '2f6ae1e0-f61a-48ce-be23-6fb68e7c9f19', -- IONOS
  '07c83d55-12a0-46ee-b4e2-2dcdb68078a0',
  '602f6b14-8f01-4b6f-9084-bbd20ebf5757',
  '753b0a15-a947-4343-8bc4-a5acc652aac9', -- Ivana Pavosevic (different dates)
  '6e461909-1e05-43ea-8d90-0f3c02f398ec',
  'e6a02c4b-6ed7-428b-905d-5a9a58ce9f58', -- Amazon Marketplace
  'f17bce7e-76df-43ac-be43-9e78d32f14ef',
  'ea7384b6-c5cb-4315-bcc8-c8a1f94d6158', -- natursteine-deisl
  '65b8e7a6-2513-4544-b469-f9e97157fa9a',
  '819645a1-a8c0-443f-90ab-dc787a3cd922', -- Repaint
  '0f9d0c5d-81f4-4615-9532-36fbba30e1a0',
  '1c8bd610-f07c-4525-892a-698c16556666', -- Meta (recurring ads)
  '045f285c-28d9-4b03-b7fc-743c7da64466',
  'b7ead5fd-12cc-450e-bbf7-2f7d2834bb47',
  '0551fbb7-1beb-43fd-a812-b22de6d4e7ed',
  'af8f13fe-79b3-4b84-b20f-61e456a03d83',
  '282b7a53-dfef-40fe-b080-33a2c8ab806e',
  -- No twin in DB
  '298057bf-71d3-4fa3-9869-3955252b0db5', -- HoT
  'eeb6997e-97a4-4664-be0b-a8d404a77484', -- IKEA
  'c1c8226e-32d5-4135-ba50-e1afe17e7dc8', -- Mattex
  'c198aaca-1f86-4e6e-9743-c649a948fa54', -- Monta
  '2ef58ce6-1be3-4eb0-bd12-bf8fabb7c5db'  -- Monta
);

-- Also clear status='duplicate' on any of the unmarked, if applicable
UPDATE public.receipts
SET status = 'approved'
WHERE id IN (
  '2f6ae1e0-f61a-48ce-be23-6fb68e7c9f19','07c83d55-12a0-46ee-b4e2-2dcdb68078a0','602f6b14-8f01-4b6f-9084-bbd20ebf5757',
  '753b0a15-a947-4343-8bc4-a5acc652aac9','6e461909-1e05-43ea-8d90-0f3c02f398ec',
  'e6a02c4b-6ed7-428b-905d-5a9a58ce9f58','f17bce7e-76df-43ac-be43-9e78d32f14ef',
  'ea7384b6-c5cb-4315-bcc8-c8a1f94d6158','65b8e7a6-2513-4544-b469-f9e97157fa9a',
  '819645a1-a8c0-443f-90ab-dc787a3cd922','0f9d0c5d-81f4-4615-9532-36fbba30e1a0',
  '1c8bd610-f07c-4525-892a-698c16556666','045f285c-28d9-4b03-b7fc-743c7da64466','b7ead5fd-12cc-450e-bbf7-2f7d2834bb47',
  '0551fbb7-1beb-43fd-a812-b22de6d4e7ed','af8f13fe-79b3-4b84-b20f-61e456a03d83','282b7a53-dfef-40fe-b080-33a2c8ab806e',
  '298057bf-71d3-4fa3-9869-3955252b0db5','eeb6997e-97a4-4664-be0b-a8d404a77484','c1c8226e-32d5-4135-ba50-e1afe17e7dc8',
  'c198aaca-1f86-4e6e-9743-c649a948fa54','2ef58ce6-1be3-4eb0-bd12-bf8fabb7c5db'
) AND status = 'duplicate';

-- 2) Mark the OLDEST of each true-duplicate group as ORIGINAL
UPDATE public.receipts
SET is_duplicate = false,
    duplicate_of = NULL,
    duplicate_score = NULL,
    duplicate_checked_at = now()
WHERE id IN (
  '6f680031-cee2-4712-8f3f-e2ff0ed2e602', -- Amazon PL55V4PCAEUI (oldest)
  '86b1f85b-1471-4615-b352-568c29c92f53', -- HoT
  '9f703d38-a185-4bad-9d16-b632d1ea5a28', -- Naturwerkstatt
  '80df5d12-e994-4c66-a689-54368df666e9', -- Privatvermieter (oldest of the no-inv# pair)
  'f4fc52d6-a180-486d-bd92-eed5254b31d4', -- spusu
  '5261abad-17e3-49a5-a3a9-0a94dfe37072', -- Webflow
  '8f940b18-08f4-4826-83d9-e25bf51802c0', -- WeTi INET2600457
  '05e72785-4297-4216-8143-4f22b169917c', -- WeTi INET2600526
  '8049353c-927d-4597-a4bb-a120d7059959', -- Raiffeisen
  '5399b174-084f-4c6a-87bf-bcc56e906546', -- file hash 12b1
  'e025e02f-8c7f-45b3-95d9-d8bfd63f7773', -- file hash 6135
  '07d89625-27be-470c-8554-793e8a7b241e', -- file hash 6aad
  '4ecc4f5b-421a-4bcf-8912-438557305ccb'  -- file hash fc51
);

-- 3) Point each true-dup record to its proper original (oldest)
UPDATE public.receipts SET is_duplicate = true, duplicate_of = '6f680031-cee2-4712-8f3f-e2ff0ed2e602', duplicate_checked_at = now()
  WHERE id IN ('969b1619-ecdd-4fa1-b474-165f7b2764c1','0f826ef8-cbb9-47e5-8054-532090e0e4fb');

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '86b1f85b-1471-4615-b352-568c29c92f53', duplicate_checked_at = now()
  WHERE id = '7258d8b4-0911-41c8-9b14-36d7b999c414';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '9f703d38-a185-4bad-9d16-b632d1ea5a28', duplicate_checked_at = now()
  WHERE id = '4812e6fa-7573-4cbc-adec-3e7ab9e6e038';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '80df5d12-e994-4c66-a689-54368df666e9', duplicate_checked_at = now()
  WHERE id = '1565975b-f4cc-4c15-a19d-71a714165724';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = 'f4fc52d6-a180-486d-bd92-eed5254b31d4', duplicate_checked_at = now()
  WHERE id = '1f705599-7798-47f1-9b80-051b03eb1504';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '5261abad-17e3-49a5-a3a9-0a94dfe37072', duplicate_checked_at = now()
  WHERE id = '3a686739-0089-452c-bbca-adc156e55583';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '8f940b18-08f4-4826-83d9-e25bf51802c0', duplicate_checked_at = now()
  WHERE id = 'bb49fced-ba90-4933-b3ac-869dcb03b66f';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '05e72785-4297-4216-8143-4f22b169917c', duplicate_checked_at = now()
  WHERE id = '078a771c-24f5-4cb1-806d-2842330b6545';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '8049353c-927d-4597-a4bb-a120d7059959', duplicate_checked_at = now()
  WHERE id = '85528b51-5f5e-4fcb-8d8e-1f48cef81bcb';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '5399b174-084f-4c6a-87bf-bcc56e906546', duplicate_checked_at = now()
  WHERE id = '5176b7aa-b626-47e0-bf34-9c9f77996aae';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = 'e025e02f-8c7f-45b3-95d9-d8bfd63f7773', duplicate_checked_at = now()
  WHERE id = 'a37d5342-719b-4030-915b-628d982daf7c';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '07d89625-27be-470c-8554-793e8a7b241e', duplicate_checked_at = now()
  WHERE id = 'f97e1e4c-3555-4b21-abc4-9938befb9cdb';

UPDATE public.receipts SET is_duplicate = true, duplicate_of = '4ecc4f5b-421a-4bcf-8912-438557305ccb', duplicate_checked_at = now()
  WHERE id = 'f5ac7dd6-5cbd-4faf-98f9-2da30c26153a';
