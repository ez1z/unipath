UPDATE scholarships
SET amount_usd = 2577,
    amount_usd_max = 8522,
    description_en = 'Need-based regional grant from DiSCo Lazio for students at universities legally based in Lazio, covering 2025-26 ISEE eligibility brackets up to roughly €27,948. Amount varies by housing category (in sede, pendolare, fuori sede) and ISEE bracket, from about €2,250/year for in-sede students to about €7,443/year for fuori-sede students with low ISEE; STEM and other bonuses can increase the amount further.'
WHERE name_en = 'DiSCo Lazio Right to Study Grant (DSU)'
  AND country ILIKE '%italy%';
