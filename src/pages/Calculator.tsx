import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer } from 'lucide-react';

type Currency = 'TRY' | 'EUR' | 'USD';

const currencySymbols: Record<Currency, string> = {
  TRY: '₺',
  EUR: '€',
  USD: '$',
};

const exchangeRates: Record<Currency, number> = {
  TRY: 1,
  EUR: 0.0198, // 1 TRY = 0.0198 EUR (approx 1 EUR = 50.43 TRY)
  USD: 0.0217, // approximate
};

export default function Calculator() {
  const [quantity, setQuantity] = useState<number>(0);
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [profitPerPiece, setProfitPerPiece] = useState<number>(0);

  // Base costs
  const [fabric, setFabric] = useState<number>(0);
  const [production, setProduction] = useState<number>(0);
  const [accessories, setAccessories] = useState<number>(0);

  // Pattern costs
  const [patternPerPiece, setPatternPerPiece] = useState<number>(0);
  const [patternSetup, setPatternSetup] = useState<number>(0);

  // Optional extras
  const [embroidery, setEmbroidery] = useState<number>(0);
  const [printing, setPrinting] = useState<number>(0);
  const [extraFees, setExtraFees] = useState<number>(0);
  const [washing, setWashing] = useState<number>(0);

  // Calculations (all in TRY first)
  const extrasPerPiece = embroidery + printing + extraFees + washing;
  const patternCostPerPiece = quantity > 0 ? patternPerPiece + patternSetup / quantity : patternPerPiece;
  const totalCostPerPiece = fabric + production + accessories + patternCostPerPiece + extrasPerPiece;
  const totalCost = totalCostPerPiece * quantity;
  const costWithProfitPerPiece = totalCostPerPiece + profitPerPiece;
  const totalWithProfit = costWithProfitPerPiece * quantity;
  const totalProfit = profitPerPiece * quantity;

  // Convert to display currency
  const convert = (amount: number): number => {
    return amount * exchangeRates[currency];
  };

  const formatCurrency = (amount: number): string => {
    const converted = convert(amount);
    return `${currencySymbols[currency]}${converted.toFixed(2)}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WDS Pricing Calculator</h1>
          <p className="text-muted-foreground">Calculate manufacturing costs and profit margins</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Order Details */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Order Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      value={quantity || ''}
                      onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Display Currency</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRY">TRY (₺)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profit">Your Profit per Piece (TRY)</Label>
                  <Input
                    id="profit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={profitPerPiece || ''}
                    onChange={(e) => setProfitPerPiece(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Base Costs */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Base Costs (per piece in TRY)</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fabric">1. Fabric</Label>
                    <Input
                      id="fabric"
                      type="number"
                      min="0"
                      step="0.01"
                      value={fabric || ''}
                      onChange={(e) => setFabric(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="production">2. Production</Label>
                    <Input
                      id="production"
                      type="number"
                      min="0"
                      step="0.01"
                      value={production || ''}
                      onChange={(e) => setProduction(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accessories">3. Accessories</Label>
                    <Input
                      id="accessories"
                      type="number"
                      min="0"
                      step="0.01"
                      value={accessories || ''}
                      onChange={(e) => setAccessories(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pattern Costs */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Pattern Costs (in TRY)</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="patternPerPiece">Pattern per Piece</Label>
                    <Input
                      id="patternPerPiece"
                      type="number"
                      min="0"
                      step="0.01"
                      value={patternPerPiece || ''}
                      onChange={(e) => setPatternPerPiece(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patternSetup">Pattern Setup (one-time)</Label>
                    <Input
                      id="patternSetup"
                      type="number"
                      min="0"
                      step="0.01"
                      value={patternSetup || ''}
                      onChange={(e) => setPatternSetup(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Optional Extras */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Optional Extras (per piece in TRY)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="embroidery">Embroidery</Label>
                    <Input
                      id="embroidery"
                      type="number"
                      min="0"
                      step="0.01"
                      value={embroidery || ''}
                      onChange={(e) => setEmbroidery(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="printing">Printing</Label>
                    <Input
                      id="printing"
                      type="number"
                      min="0"
                      step="0.01"
                      value={printing || ''}
                      onChange={(e) => setPrinting(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extraFees">Extra Fees</Label>
                    <Input
                      id="extraFees"
                      type="number"
                      min="0"
                      step="0.01"
                      value={extraFees || ''}
                      onChange={(e) => setExtraFees(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="washing">Washing</Label>
                    <Input
                      id="washing"
                      type="number"
                      min="0"
                      step="0.01"
                      value={washing || ''}
                      onChange={(e) => setWashing(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            {/* Cost Breakdown */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="text-lg font-semibold">Cost Breakdown</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fabric</span>
                  <span>{formatCurrency(fabric)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Production</span>
                  <span>{formatCurrency(production)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Accessories (per piece)</span>
                  <span>{formatCurrency(accessories)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pattern cost (per piece + setup)</span>
                  <span>{formatCurrency(patternCostPerPiece)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extras per piece</span>
                  <span>{formatCurrency(extrasPerPiece)}</span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Total cost per piece</span>
                    <span>{formatCurrency(totalCostPerPiece)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg mt-2">
                    <span>Total for {quantity} pieces</span>
                    <span>{formatCurrency(totalCost)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost With Profit */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="text-lg font-semibold">Cost With Your Profit</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Per piece</span>
                  <span>{formatCurrency(costWithProfitPerPiece)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total ({quantity} pieces)</span>
                  <span className="text-primary">{formatCurrency(totalWithProfit)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Your Profit */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="text-lg font-semibold">Your Profit</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Per piece</span>
                  <span>{formatCurrency(profitPerPiece)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total ({quantity} pieces)</span>
                  <span className="text-primary">{formatCurrency(totalProfit)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Print Button */}
            <Button onClick={handlePrint} className="w-full" size="lg">
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Exchange rate: 1 EUR = 50.43 TRY (manually updated)
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
