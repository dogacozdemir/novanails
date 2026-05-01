-- Randevu durumu: WhatsApp teyit mesajı gönderildi
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'message_sent';
