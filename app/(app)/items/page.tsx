'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useActiveSupplier } from '@/lib/supplier-context'
import { GlassCard } from '@/components/glass-card'
import { toast } from 'sonner'
import { Package, Plus, Pencil, Trash2, Search, Save, Loader2, X, Upload } from 'lucide-react'
import { ConfirmModal } from '@/components/confirm-modal'

interface LineItemTemplate {
  id: string
  supplier_id: string
  seq: number
  name: string
  description: string | null
  quantity: number
  unit: string
  unit_price: number
  vat_rate: number
  vat_category: string
  discount_percent: number
  charge_percent: number
  color_category: string
  sort_order: number
  created_at: string
  updated_at: string
}

const emptyItem: Omit<LineItemTemplate, 'id' | 'supplier_id' | 'created_at' | 'updated_at' | 'sort_order'> = {
  seq: 0,
  name: '',
  description: '',
  quantity: 1,
  unit: 'C62',
  unit_price: 0,
  vat_rate: 23,
  vat_category: 'S',
  discount_percent: 0,
  charge_percent: 0,
  color_category: 'bg-slate-500',
}

const unitOptions = [
  { value: 'C62', label: 'ks (kus)' },
  { value: 'HUR', label: 'hod (hodina)' },
  { value: 'DAY', label: 'den' },
  { value: 'MON', label: 'mesiac' },
  { value: 'KGM', label: 'kg' },
  { value: 'MTR', label: 'm' },
  { value: 'LTR', label: 'l' },
  { value: 'MTK', label: 'm2' },
]

const vatOptions = [
  { rate: 23, label: '23% (základná)' },
  { rate: 19, label: '19% (znížená)' },
  { rate: 10, label: '10% (znížená)' },
  { rate: 5, label: '5% (znížená)' },
  { rate: 0, label: '0% (oslobodené)' },
]

const colorOptions = [
  { value: 'bg-slate-500', label: '⬜ Sivá' },
  { value: 'bg-blue-500', label: '🔵 Modrá' },
  { value: 'bg-red-500', label: '🔴 Červená' },
  { value: 'bg-green-500', label: '🟢 Zelená' },
  { value: 'bg-yellow-500', label: '🟡 Žltá' },
  { value: 'bg-purple-500', label: '🟣 Fialová' },
  { value: 'bg-pink-500', label: '💗 Ružová' },
  { value: 'bg-orange-500', label: '🟠 Oranžová' },
]

export default function ItemsPage() {
  const supabase = createClient()
  const { activeSupplier, loading: supplierLoading } = useActiveSupplier()
  const [items, setItems] = useState<LineItemTemplate[]>([])
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyItem)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [importingCsv, setImportingCsv] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const loadItems = useCallback(async () => {
    if (!activeSupplier) { setLoading(false); return }
    const { data } = await supabase
      .from('line_item_templates')
      .select('*')
      .eq('supplier_id', activeSupplier.id)
      .order('seq')
    setItems((data ?? []) as LineItemTemplate[])
    setLoading(false)
  }, [activeSupplier, supabase])

  useEffect(() => { loadItems() }, [loadItems])

  async function saveItem() {
    if (!form.seq || form.seq < 1) {
      toast.error('Poradové číslo je povinné (min. 1)')
      return
    }
    if (!form.name.trim()) {
      toast.error('Názov položky je povinný')
      return
    }
    if (form.quantity <= 0) {
      toast.error('Množstvo musí byť viac ako 0')
      return
    }
    if (form.unit_price < 0) {
      toast.error('Cena nesmie byť záporná')
      return
    }
    if (!activeSupplier) {
      toast.error('Zvoľte firmu')
      return
    }

    // Check if seq already exists (for new items)
    if (!editingId) {
      const existing = items.some(i => i.seq === form.seq)
      if (existing) {
        toast.error(`Položka s poradovým číslom ${form.seq} už existuje`)
        return
      }
    }

    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('line_item_templates')
          .update(form)
          .eq('id', editingId)
        if (error) throw error
        toast.success('Položka aktualizovaná')
      } else {
        const { error } = await supabase
          .from('line_item_templates')
          .insert({ ...form, supplier_id: activeSupplier.id, user_id: activeSupplier.user_id })
        if (error) throw error
        toast.success('Položka vytvorená')
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyItem)
      loadItems()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(item: LineItemTemplate) {
    setEditingId(item.id)
    setForm({
      seq: item.seq,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      vat_category: item.vat_category,
      discount_percent: item.discount_percent,
      charge_percent: item.charge_percent,
      color_category: item.color_category,
    })
    setShowForm(true)
  }

  async function deleteItem() {
    if (!deleteTargetId) return
    try {
      const { error } = await supabase
        .from('line_item_templates')
        .delete()
        .eq('id', deleteTargetId)
      if (error) throw error
      toast.success('Položka bola zmazaná')
      setDeleteTargetId(null)
      loadItems()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function importCsv(file: File) {
    setImportingCsv(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      
      // Skip header if present
      let dataLines = lines
      if (lines.length > 0 && (lines[0].includes('seq') || lines[0].includes('name'))) {
        dataLines = lines.slice(1)
      }

      if (!activeSupplier) throw new Error('Zvoľte firmu')

      const toInsert: any[] = []
      const errors: string[] = []

      dataLines.forEach((line, idx) => {
        const parts = line.split(',').map(p => p.trim())
        if (parts.length < 6) {
          errors.push(`Riadok ${idx + 1}: Nedostatok polí (požadované: seq, name, quantity, unit, unit_price, vat_rate)`)
          return
        }

        const [seqStr, name, qtyStr, unit, priceStr, vatStr, ...rest] = parts
        const seq = parseInt(seqStr)
        const quantity = parseFloat(qtyStr)
        const unit_price = parseFloat(priceStr)
        const vat_rate = parseFloat(vatStr)

        if (!seq || seq < 1) {
          errors.push(`Riadok ${idx + 1}: Neplatné poradové číslo`)
          return
        }
        if (!name) {
          errors.push(`Riadok ${idx + 1}: Chýba názov`)
          return
        }
        if (!quantity || quantity <= 0) {
          errors.push(`Riadok ${idx + 1}: Neplatné množstvo`)
          return
        }
        if (!unit) {
          errors.push(`Riadok ${idx + 1}: Chýba jednotka`)
          return
        }
        if (!unit_price || unit_price < 0) {
          errors.push(`Riadok ${idx + 1}: Neplatná cena`)
          return
        }
        if (!vat_rate) {
          errors.push(`Riadok ${idx + 1}: Neplatná DPH sadzba`)
          return
        }

        // Check for duplicate seq
        if (items.some(i => i.seq === seq) || toInsert.some(i => i.seq === seq)) {
          errors.push(`Riadok ${idx + 1}: Poradové číslo ${seq} už existuje`)
          return
        }

        const description = rest[0] || null
        const discount_percent = rest[1] ? parseFloat(rest[1]) : 0
        const charge_percent = rest[2] ? parseFloat(rest[2]) : 0
        const color_category = rest[3] || 'bg-slate-500'

        toInsert.push({
          supplier_id: activeSupplier.id,
          user_id: activeSupplier.user_id,
          seq,
          name,
          quantity,
          unit,
          unit_price,
          vat_rate,
          vat_category: 'S',
          description,
          discount_percent,
          charge_percent,
          color_category,
        })
      })

      if (errors.length > 0) {
        toast.error(`${errors.length} chýb:\n${errors.slice(0, 3).join('\n')}`)
        return
      }

      if (toInsert.length === 0) {
        toast.error('Žiadne položky na import')
        return
      }

      const { error } = await supabase
        .from('line_item_templates')
        .insert(toInsert)
      
      if (error) throw error
      toast.success(`${toInsert.length} položiek importovaných`)
      loadItems()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setImportingCsv(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )

  if (supplierLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!activeSupplier) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
        <GlassCard className="max-w-md mx-auto">
          <h1 className="text-xl font-bold text-foreground mb-2">Položky faktúry</h1>
          <p className="text-muted-foreground">Zvoľte firmu v hornej lište</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Položky</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={importingCsv}
              className="px-4 py-2 rounded-xl bg-slate-700 text-slate-200 font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {importingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) importCsv(file)
              }}
              className="hidden"
            />
            <button
              onClick={() => {
                setEditingId(null)
                setForm(emptyItem)
                setShowForm(!showForm)
              }}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nová
            </button>
          </div>
        </div>

        {/* Search */}
        {items.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Hľadaj položku..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <GlassCard className="mb-6 p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {editingId ? 'Upraviť položku' : 'Nová položka'}
            </h2>

            <div className="space-y-4">
              {/* Seq + Name */}
              <div className="grid gap-4" style={{ gridTemplateColumns: '180px minmax(0, 1fr)' }}>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Poradové číslo *</label>
                  <input
                    type="number"
                    min="1"
                    value={form.seq || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, seq: parseInt(e.target.value) || 0 }))}
                    placeholder="1, 2, 3..."
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Názov *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="napr. Konzultácia"
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Popis</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Voliteľný popis..."
                  rows={2}
                  className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground placeholder:text-muted-foreground resize-none"
                />
              </div>

              {/* Quantity, Unit, Price */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Množstvo *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.quantity}
                    onChange={(e) => setForm(prev => ({ ...prev, quantity: parseFloat(e.target.value) }))}
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Jednotka *</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground bg-slate-800 border border-slate-700"
                  >
                    {unitOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Cena za jednotku € *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unit_price}
                    onChange={(e) => setForm(prev => ({ ...prev, unit_price: parseFloat(e.target.value) }))}
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground"
                  />
                </div>
              </div>

              {/* VAT, Discount, Charge, Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">DPH *</label>
                  <select
                    value={form.vat_rate}
                    onChange={(e) => setForm(prev => ({ ...prev, vat_rate: parseFloat(e.target.value) }))}
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground bg-slate-800 border border-slate-700"
                  >
                    {vatOptions.map(opt => (
                      <option key={opt.rate} value={opt.rate}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Farba/Kategória</label>
                  <select
                    value={form.color_category}
                    onChange={(e) => setForm(prev => ({ ...prev, color_category: e.target.value }))}
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground bg-slate-800 border border-slate-700"
                  >
                    {colorOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Discount & Charge */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Zľava %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.discount_percent}
                    onChange={(e) => setForm(prev => ({ ...prev, discount_percent: parseFloat(e.target.value) }))}
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Príplatok %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.charge_percent}
                    onChange={(e) => setForm(prev => ({ ...prev, charge_percent: parseFloat(e.target.value) }))}
                    className="glass-input w-full px-3.5 py-2.5 rounded-xl text-foreground"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={saveItem}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Uložiť
                </button>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setForm(emptyItem)
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 text-foreground font-medium hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Zrušiť
                </button>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Items List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                {items.length === 0 ? 'Žiadne položky. Vytvor si prvú!' : 'Žiadne položky sa nezhodujú s hľadaním.'}
              </p>
            </GlassCard>
          ) : (
            filteredItems.map(item => (
              <GlassCard key={item.id} className="p-4 flex items-start justify-between hover:bg-slate-700/50 transition-colors">
                <div className="flex-1 flex items-start gap-3">
                  <div className={`${item.color_category} w-2 h-12 rounded flex-shrink-0`} />
                  <div>
                    <div className="font-semibold text-foreground">{item.seq}. {item.name}</div>
                    {item.description && <div className="text-sm text-muted-foreground mt-1">{item.description}</div>}
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{item.quantity} × {unitOptions.find(u => u.value === item.unit)?.label}</span>
                      <span>{item.unit_price.toFixed(2)} € / jednotka</span>
                      <span>{item.vat_rate.toFixed(1)}% DPH</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-3">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-2 rounded-lg hover:bg-slate-600 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(item.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteTargetId !== null}
        title="Zmazať položku?"
        message="Táto operácia sa nedá vrátiť späť."
        confirmLabel="Zmazať"
        onConfirm={deleteItem}
        onCancel={() => setDeleteTargetId(null)}
        isDangerous
      />
    </div>
  )
}
