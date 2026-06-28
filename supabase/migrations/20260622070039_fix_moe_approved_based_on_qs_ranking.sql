UPDATE universities
SET moe_approved = true
WHERE ranking_qs IS NOT NULL AND moe_approved = false;
