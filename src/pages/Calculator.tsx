import React, { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Printer, Plus, X, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
import { useToast } from "@/hooks/use-toast";
type Currency = "TRY" | "EUR";

interface Accessory {
  id: string;
  type: string;
  quantity: number;
  pricePerUnit: number;
}

interface OptionalExtra {
  enabled: boolean;
  cost: number;
}

const ACCESSORY_TYPES = [
  "Neck Labels",
  "Washing Labels",
  "Thanks Cards",
  "Hang Tags",
  "Packaging",
  "Zippers",
  "Rivets",
  "Laces",
  "Adjustables",
  "Key Chain Holder",
  "Buttons",
];

export default function Calculator() {
  const { toast } = useToast();
  
  // Invoice Dialog
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  
  // Order Details
  const [orderName, setOrderName] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("TRY");
  const [exchangeRate, setExchangeRate] = useState(50.43);
  // Base Costs (TRY)
  const [fabricCost, setFabricCost] = useState(0);
  const [productionCost, setProductionCost] = useState(0);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [accessoriesOpen, setAccessoriesOpen] = useState(false);

  // Additional Costs (TRY)
  const [patternCostPerPiece, setPatternCostPerPiece] = useState(0);
  const [patternSetupCost, setPatternSetupCost] = useState(0);

  // Optional Extras
  const [embroidery, setEmbroidery] = useState<OptionalExtra>({ enabled: false, cost: 0 });
  const [printing, setPrinting] = useState<OptionalExtra>({ enabled: false, cost: 0 });
  const [digitalPrinting, setDigitalPrinting] = useState<OptionalExtra>({ enabled: false, cost: 0 });
  const [extraFees, setExtraFees] = useState<OptionalExtra>({ enabled: false, cost: 0 });
  const [washing, setWashing] = useState<OptionalExtra>({ enabled: false, cost: 0 });

  // Profit
  const [profitPerPiece, setProfitPerPiece] = useState(0);
  const [profitCurrency, setProfitCurrency] = useState<Currency>("TRY");

  // Add new accessory
  const addAccessory = () => {
    setAccessories([
      ...accessories,
      { id: crypto.randomUUID(), type: ACCESSORY_TYPES[0], quantity: 1, pricePerUnit: 0 },
    ]);
  };

  // Remove accessory
  const removeAccessory = (id: string) => {
    setAccessories(accessories.filter((a) => a.id !== id));
  };

  // Update accessory
  const updateAccessory = (id: string, field: keyof Accessory, value: string | number) => {
    setAccessories(
      accessories.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  // Calculations
  const calculations = useMemo(() => {
    const qty = quantity || 1;

    // Accessories cost per piece
    const accessoriesPerPiece = accessories.reduce((sum, acc) => {
      return sum + (acc.quantity * acc.pricePerUnit) / qty;
    }, 0);

    // Setup cost per piece
    const setupPerPiece = patternSetupCost / qty;

    // Extras per piece
    const extrasPerPiece =
      (embroidery.enabled ? embroidery.cost : 0) +
      (printing.enabled ? printing.cost : 0) +
      (digitalPrinting.enabled ? digitalPrinting.cost : 0) +
      (extraFees.enabled ? extraFees.cost : 0) +
      (washing.enabled ? washing.cost : 0);

    // Total cost in TRY
    const totalCostTRY =
      fabricCost +
      productionCost +
      accessoriesPerPiece +
      patternCostPerPiece +
      setupPerPiece +
      extrasPerPiece;

    // Profit in TRY
    const profitInTRY =
      profitCurrency === "EUR" ? profitPerPiece * exchangeRate : profitPerPiece;

    // Wholesale price in TRY
    const wholesalePriceTRY = totalCostTRY + profitInTRY;

    // Retail price in TRY
    const retailPriceTRY = wholesalePriceTRY * 2.2;

    return {
      fabricCostTRY: fabricCost,
      productionCostTRY: productionCost,
      accessoriesPerPiece,
      patternCostPerPiece,
      setupPerPiece,
      extrasPerPiece,
      totalCostTRY,
      profitInTRY,
      wholesalePriceTRY,
      retailPriceTRY,
    };
  }, [
    quantity,
    fabricCost,
    productionCost,
    accessories,
    patternCostPerPiece,
    patternSetupCost,
    embroidery,
    printing,
    digitalPrinting,
    extraFees,
    washing,
    profitPerPiece,
    profitCurrency,
    exchangeRate,
  ]);

  // Format currency
  const formatCurrency = (valueTRY: number): string => {
    if (displayCurrency === "EUR") {
      return `€${(valueTRY / exchangeRate).toFixed(2)}`;
    }
    return `₺${valueTRY.toFixed(2)}`;
  };

  // Print report
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pricing Report - ${orderName || "Untitled Order"}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; background: #fafaf9; color: #1c1917; }
          .header { margin-bottom: 32px; border-bottom: 2px solid #F97316; padding-bottom: 16px; }
          .header h1 { font-size: 24px; font-weight: 700; color: #1c1917; }
          .header p { color: #78716c; margin-top: 4px; }
          .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
          .meta-item { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e7e5e4; }
          .meta-item label { font-size: 12px; color: #78716c; text-transform: uppercase; }
          .meta-item value { font-size: 18px; font-weight: 600; display: block; margin-top: 4px; }
          .section { background: white; padding: 24px; border-radius: 12px; border: 1px solid #e7e5e4; margin-bottom: 24px; }
          .section h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #F97316; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f4; }
          .row:last-child { border-bottom: none; }
          .row label { color: #57534e; }
          .row value { font-weight: 500; }
          .total-section { background: linear-gradient(135deg, #F97316 0%, #ea580c 100%); color: white; padding: 24px; border-radius: 12px; }
          .total-section h2 { color: white; margin-bottom: 16px; }
          .total-section .row { border-color: rgba(255,255,255,0.2); }
          .total-section .row label, .total-section .row value { color: white; }
          .total-section .row.main value { font-size: 24px; font-weight: 700; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>WDS Pricing Report</h1>
          <p>${orderName || "Untitled Order"}</p>
        </div>
        
        <div class="meta">
          <div class="meta-item">
            <label>Quantity</label>
            <value>${quantity} pcs</value>
          </div>
          <div class="meta-item">
            <label>Exchange Rate</label>
            <value>1 EUR = ${exchangeRate} TRY</value>
          </div>
          <div class="meta-item">
            <label>Date</label>
            <value>${new Date().toLocaleDateString()}</value>
          </div>
        </div>
        
        <div class="section">
          <h2>Base Costs</h2>
          <div class="row"><label>Fabric Cost</label><value>${formatCurrency(calculations.fabricCostTRY)}</value></div>
          <div class="row"><label>Production Cost</label><value>${formatCurrency(calculations.productionCostTRY)}</value></div>
          <div class="row"><label>Accessories Cost</label><value>${formatCurrency(calculations.accessoriesPerPiece)}</value></div>
        </div>
        
        ${accessories.length > 0 ? `
        <div class="section">
          <h2>Accessories Breakdown</h2>
          ${accessories.map(acc => `
            <div class="row">
              <label>${acc.type} (${acc.quantity} × ${formatCurrency(acc.pricePerUnit)})</label>
              <value>${formatCurrency((acc.quantity * acc.pricePerUnit) / quantity)}</value>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        <div class="section">
          <h2>Pattern Costs</h2>
          <div class="row"><label>Pattern per Piece</label><value>${formatCurrency(calculations.patternCostPerPiece)}</value></div>
          <div class="row"><label>Setup Cost (per piece)</label><value>${formatCurrency(calculations.setupPerPiece)}</value></div>
        </div>
        
        ${calculations.extrasPerPiece > 0 ? `
        <div class="section">
          <h2>Optional Extras</h2>
          ${embroidery.enabled ? `<div class="row"><label>Embroidery</label><value>${formatCurrency(embroidery.cost)}</value></div>` : ''}
          ${printing.enabled ? `<div class="row"><label>Printing</label><value>${formatCurrency(printing.cost)}</value></div>` : ''}
          ${digitalPrinting.enabled ? `<div class="row"><label>Digital Printing</label><value>${formatCurrency(digitalPrinting.cost)}</value></div>` : ''}
          ${extraFees.enabled ? `<div class="row"><label>Extra Fees</label><value>${formatCurrency(extraFees.cost)}</value></div>` : ''}
          ${washing.enabled ? `<div class="row"><label>Washing</label><value>${formatCurrency(washing.cost)}</value></div>` : ''}
        </div>
        ` : ''}
        
        <div class="total-section">
          <h2>Final Results</h2>
          <div class="row"><label>Total Cost per Piece</label><value>${formatCurrency(calculations.totalCostTRY)}</value></div>
          <div class="row"><label>Profit per Piece</label><value>${formatCurrency(calculations.profitInTRY)}</value></div>
          <div class="row main"><label>Wholesale Price</label><value>${formatCurrency(calculations.wholesalePriceTRY)}</value></div>
          <div class="row main"><label>Retail Price (×2.2)</label><value>${formatCurrency(calculations.retailPriceTRY)}</value></div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-stone-50 relative">
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        }} />
        
        <div className="relative z-10 p-6">
          <h1 className="text-2xl font-bold text-stone-900 mb-6">Pricing Calculator</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Inputs */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Details */}
              <Card className="backdrop-blur-xl bg-white/70 border-stone-200/50 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-stone-800">Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-stone-600">Order Name</Label>
                      <Input
                        value={orderName}
                        onChange={(e) => setOrderName(e.target.value)}
                        placeholder="Enter order name"
                        className="bg-white/50 border-stone-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-stone-600">Quantity</Label>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="bg-white/50 border-stone-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-stone-600">Display Currency</Label>
                      <Select value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as Currency)}>
                        <SelectTrigger className="bg-white/50 border-stone-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-stone-200">
                          <SelectItem value="TRY">₺ TRY</SelectItem>
                          <SelectItem value="EUR">€ EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-stone-600">Exchange Rate (1 EUR = ? TRY)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(Number(e.target.value))}
                        className="bg-white/50 border-stone-200"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Base Costs */}
              <Card className="backdrop-blur-xl bg-white/70 border-stone-200/50 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-stone-800">Base Costs (TRY)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-stone-600">Fabric Cost per Piece</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={fabricCost || ""}
                        onChange={(e) => setFabricCost(Number(e.target.value))}
                        placeholder="0.00"
                        className="bg-white/50 border-stone-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-stone-600">Production Cost per Piece</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={productionCost || ""}
                        onChange={(e) => setProductionCost(Number(e.target.value))}
                        placeholder="0.00"
                        className="bg-white/50 border-stone-200"
                      />
                    </div>
                  </div>

                  {/* Accessories Collapsible */}
                  <Collapsible open={accessoriesOpen} onOpenChange={setAccessoriesOpen}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between bg-white/50 border-stone-200 hover:bg-white/80"
                      >
                        <span className="flex items-center gap-2">
                          Accessories ({accessories.length})
                        </span>
                        {accessoriesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-3">
                      {accessories.map((acc) => (
                        <div key={acc.id} className="flex items-end gap-2 p-3 bg-white/40 rounded-lg">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-stone-500">Type</Label>
                            <Select
                              value={acc.type}
                              onValueChange={(v) => updateAccessory(acc.id, "type", v)}
                            >
                              <SelectTrigger className="bg-white/50 border-stone-200 h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-stone-200">
                                {ACCESSORY_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24 space-y-1">
                            <Label className="text-xs text-stone-500">Qty</Label>
                            <Input
                              type="number"
                              value={acc.quantity || ""}
                              onChange={(e) => updateAccessory(acc.id, "quantity", Number(e.target.value))}
                              className="bg-white/50 border-stone-200 h-9"
                            />
                          </div>
                          <div className="w-28 space-y-1">
                            <Label className="text-xs text-stone-500">Price/Unit</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={acc.pricePerUnit || ""}
                              onChange={(e) => updateAccessory(acc.id, "pricePerUnit", Number(e.target.value))}
                              className="bg-white/50 border-stone-200 h-9"
                            />
                          </div>
                          <div className="w-24 text-right">
                            <span className="text-xs text-stone-500 block mb-1">Per Piece</span>
                            <span className="text-sm font-medium text-stone-700">
                              {formatCurrency((acc.quantity * acc.pricePerUnit) / (quantity || 1))}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAccessory(acc.id)}
                            className="h-9 w-9 text-stone-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={addAccessory}
                        className="w-full border-dashed border-stone-300 text-stone-600 hover:bg-white/50"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Accessory
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              {/* Additional Costs */}
              <Card className="backdrop-blur-xl bg-white/70 border-stone-200/50 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-stone-800">Additional Costs (TRY)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-stone-600">Pattern Cost per Piece</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={patternCostPerPiece || ""}
                        onChange={(e) => setPatternCostPerPiece(Number(e.target.value))}
                        placeholder="0.00"
                        className="bg-white/50 border-stone-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-stone-600">Pattern Setup Cost (one-time)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={patternSetupCost || ""}
                        onChange={(e) => setPatternSetupCost(Number(e.target.value))}
                        placeholder="0.00"
                        className="bg-white/50 border-stone-200"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Optional Extras */}
              <Card className="backdrop-blur-xl bg-white/70 border-stone-200/50 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-stone-800">Optional Extras (per piece in TRY)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Embroidery", state: embroidery, setState: setEmbroidery },
                    { label: "Printing", state: printing, setState: setPrinting },
                    { label: "Digital Printing", state: digitalPrinting, setState: setDigitalPrinting },
                    { label: "Extra Fees", state: extraFees, setState: setExtraFees },
                    { label: "Washing", state: washing, setState: setWashing },
                  ].map(({ label, state, setState }) => (
                    <div key={label} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-40">
                        <Checkbox
                          checked={state.enabled}
                          onCheckedChange={(checked) =>
                            setState({ ...state, enabled: checked as boolean })
                          }
                          className="border-stone-300 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                        />
                        <Label className="text-stone-600 cursor-pointer">{label}</Label>
                      </div>
                      {state.enabled && (
                        <Input
                          type="number"
                          step="0.01"
                          value={state.cost || ""}
                          onChange={(e) => setState({ ...state, cost: Number(e.target.value) })}
                          placeholder="0.00"
                          className="flex-1 max-w-32 bg-white/50 border-stone-200"
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Profit Margins */}
              <Card className="backdrop-blur-xl bg-white/70 border-stone-200/50 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-stone-800">Profit Margins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-stone-600">Profit per Piece</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={profitPerPiece || ""}
                        onChange={(e) => setProfitPerPiece(Number(e.target.value))}
                        placeholder="0.00"
                        className="bg-white/50 border-stone-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-stone-600">Profit Currency</Label>
                      <Select value={profitCurrency} onValueChange={(v) => setProfitCurrency(v as Currency)}>
                        <SelectTrigger className="bg-white/50 border-stone-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-stone-200">
                          <SelectItem value="TRY">₺ TRY</SelectItem>
                          <SelectItem value="EUR">€ EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Results (Sticky) */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-6">
                {/* Cost Breakdown */}
                <Card className="backdrop-blur-xl bg-white/70 border-stone-200/50 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-stone-800">Cost Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">Fabric Cost</span>
                      <span className="font-medium text-stone-800">{formatCurrency(calculations.fabricCostTRY)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">Production Cost</span>
                      <span className="font-medium text-stone-800">{formatCurrency(calculations.productionCostTRY)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">Accessories Cost</span>
                      <span className="font-medium text-stone-800">{formatCurrency(calculations.accessoriesPerPiece)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">Pattern Cost</span>
                      <span className="font-medium text-stone-800">{formatCurrency(calculations.patternCostPerPiece)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">Setup Cost (per piece)</span>
                      <span className="font-medium text-stone-800">{formatCurrency(calculations.setupPerPiece)}</span>
                    </div>
                    {calculations.extrasPerPiece > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Extras Cost</span>
                        <span className="font-medium text-stone-800">{formatCurrency(calculations.extrasPerPiece)}</span>
                      </div>
                    )}
                    <div className="border-t border-stone-200 pt-3">
                      <div className="flex justify-between">
                        <span className="font-semibold text-stone-700">Total Cost per Piece</span>
                        <span className="font-bold text-stone-900">{formatCurrency(calculations.totalCostTRY)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cost With Your Profit */}
                <Card className="backdrop-blur-xl bg-white/70 border-stone-200/50 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-stone-800">Cost With Your Profit</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">Total Cost</span>
                      <span className="font-medium text-stone-800">{formatCurrency(calculations.totalCostTRY)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">+ Your Profit</span>
                      <span className="font-medium text-stone-800">{formatCurrency(calculations.profitInTRY)}</span>
                    </div>
                    <div className="border-t border-stone-200 pt-3">
                      <div className="flex justify-between">
                        <span className="font-semibold text-stone-700">Wholesale Price</span>
                        <span className="font-bold text-stone-900">{formatCurrency(calculations.wholesalePriceTRY)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-stone-700">Retail Price (×2.2)</span>
                      <span className="font-bold text-stone-900">{formatCurrency(calculations.retailPriceTRY)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Your Profit */}
                <Card className="backdrop-blur-xl bg-gradient-to-br from-orange-500 to-orange-600 border-orange-400/50 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-white">Your Profit</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-100">Per Piece</span>
                      <span className="font-medium text-white">{formatCurrency(calculations.profitInTRY)}</span>
                    </div>
                    <div className="border-t border-orange-400/30 pt-3">
                      <div className="flex justify-between">
                        <span className="font-semibold text-orange-100">Total Profit ({quantity} pcs)</span>
                        <span className="font-bold text-white text-xl">
                          {formatCurrency(calculations.profitInTRY * quantity)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={() => setInvoiceDialogOpen(true)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                  <Button
                    onClick={handlePrint}
                    variant="outline"
                    className="w-full border-orange-300 text-orange-600 hover:bg-orange-50"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Report
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Invoice Dialog */}
      <CreateInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        calculatorData={{
          orderName,
          quantity,
          exchangeRate,
          fabricCost,
          productionCost,
          accessoriesPerPiece: calculations.accessoriesPerPiece,
          patternCostPerPiece,
          setupPerPiece: calculations.setupPerPiece,
          embroidery,
          printing,
          digitalPrinting,
          extraFees,
          washing,
          profitInTRY: calculations.profitInTRY,
          totalCostTRY: calculations.totalCostTRY,
          wholesalePriceTRY: calculations.wholesalePriceTRY,
          retailPriceTRY: calculations.retailPriceTRY,
          accessories,
        }}
        onSuccess={() => {
          toast({
            title: "Invoice Created",
            description: "Your invoice has been saved successfully.",
          });
        }}
      />
    </DashboardLayout>
  );
}
