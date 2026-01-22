import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ImagePlus, Package } from 'lucide-react';
import type { Client } from '@/lib/types';

interface ClientCardProps {
  client: Client;
  orderCount: number;
  onClick: () => void;
  onLogoClick?: (e: React.MouseEvent) => void;
  isAdmin?: boolean;
}

export function ClientCard({ client, orderCount, onClick, onLogoClick, isAdmin }: ClientCardProps) {
  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 bg-card"
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Logo Section */}
        <div className="relative aspect-video bg-muted/50 flex items-center justify-center overflow-hidden rounded-t-lg">
          {client.logo_url ? (
            <img
              src={client.logo_url}
              alt={client.brand_name || client.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className="h-16 w-16 text-muted-foreground/30" />
          )}
          
          {/* Edit Logo Overlay (Admin only) */}
          {isAdmin && (
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              onClick={onLogoClick}
            >
              <div className="flex flex-col items-center gap-2 text-white">
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm font-medium">Change Logo</span>
              </div>
            </div>
          )}
        </div>

        {/* Client Info */}
        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-lg truncate">
            {client.brand_name || client.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground truncate">
              {client.name}
            </span>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {orderCount}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
