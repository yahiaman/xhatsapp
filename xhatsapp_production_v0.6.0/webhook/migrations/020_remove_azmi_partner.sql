-- Migration 020: Retrait de notre partenaire Azmi des agences interdites
DELETE FROM forbidden_agencies WHERE normalized_name IN ('azmi', 'abdel azmi');
