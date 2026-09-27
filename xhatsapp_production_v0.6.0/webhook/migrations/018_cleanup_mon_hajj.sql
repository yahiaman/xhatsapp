-- Migration 018: Nettoyage des faux positifs dans le dictionnaire des agences
DELETE FROM forbidden_agencies WHERE normalized_name IN ('mon hajj', 'labayk', 'fatima');

INSERT INTO forbidden_agencies (name, normalized_name) VALUES
  ('Agence Mon Hajj', 'agence mon hajj'),
  ('Mon Hajj Voyages', 'mon hajj voyages'),
  ('Institut Fatima', 'institut fatima')
ON CONFLICT (normalized_name) DO NOTHING;
