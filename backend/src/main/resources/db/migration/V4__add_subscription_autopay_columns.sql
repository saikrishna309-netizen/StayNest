-- Add Razorpay UPI AutoPay and subscription tier columns to owner_subscriptions
ALTER TABLE owner_subscriptions
    ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(30) DEFAULT 'PRO_TRIAL',
    ADD COLUMN IF NOT EXISTS autopay_status VARCHAR(30) DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS gateway_subscription_id VARCHAR(100);
