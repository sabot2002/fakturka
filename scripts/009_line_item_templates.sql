-- --------------------------------------------------------
-- Line Item Templates — pre uloženie šablón položiek
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS line_item_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id       UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  -- Mandatory fields
  seq               INTEGER NOT NULL,                           -- Poradové číslo
  name              TEXT NOT NULL,                              -- Názov položky
  quantity          NUMERIC(12,3) NOT NULL DEFAULT 1,           -- Množstvo
  unit              VARCHAR(10) NOT NULL DEFAULT 'C62',         -- Jednotka (C62=ks)
  unit_price        NUMERIC(12,5) NOT NULL,                     -- Cena za jednotku
  vat_rate          NUMERIC(5,2) NOT NULL DEFAULT 23.00,        -- DPH sadzba
  -- Optional fields
  vat_category      VARCHAR(3) DEFAULT 'S',                     -- DPH kategória (S=Standard)
  description       TEXT,                                       -- Popis (nepovinný)
  discount_percent  NUMERIC(5,2) DEFAULT 0,                     -- Zľava % (nepovinná)
  charge_percent    NUMERIC(5,2) DEFAULT 0,                     -- Príplatok % (nepovinný)
  -- Category & Styling
  color_category    VARCHAR(50) DEFAULT 'bg-slate-500',         -- Tailwind farba/kategória
  -- Metadata
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, seq)                                      -- Poradové číslo je unikátne v rámci firmy
);

ALTER TABLE line_item_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select_own" ON line_item_templates;
DROP POLICY IF EXISTS "templates_insert_own" ON line_item_templates;
DROP POLICY IF EXISTS "templates_update_own" ON line_item_templates;
DROP POLICY IF EXISTS "templates_delete_own" ON line_item_templates;

CREATE POLICY "templates_select_own" ON line_item_templates 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "templates_insert_own" ON line_item_templates 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates_update_own" ON line_item_templates 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "templates_delete_own" ON line_item_templates 
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_line_item_templates_updated_at ON line_item_templates;

CREATE TRIGGER update_line_item_templates_updated_at
  BEFORE UPDATE ON line_item_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_line_item_templates_user_id ON line_item_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_line_item_templates_supplier_id ON line_item_templates(supplier_id);
CREATE INDEX IF NOT EXISTS idx_line_item_templates_seq ON line_item_templates(supplier_id, seq);
CREATE INDEX IF NOT EXISTS idx_line_item_templates_name ON line_item_templates USING gin(to_tsvector('simple', name));

-- ✓ Script ready for Supabase SQL Editor execution
-- Table: line_item_templates with sequence numbering, color categories, CSV bulk import support
