import type { Order } from '@/lib/types';

interface OrderDetailsProps {
  order: Order;
}

export function OrderDetails({ order }: OrderDetailsProps) {
  const client = order.client as any;
  
  const details = [
    { label: 'Pattern name', value: order.product_name },
    { label: 'Size', value: order.size },
    { label: 'Collection', value: order.collection },
  ].filter(d => d.value);

  const specifications = [
    order.fabric && `Fabric : ${order.fabric}`,
    order.supplier && `Supplier : ${order.supplier}`,
    `Quantity : ${order.quantity} pieces`,
    order.pieces_sent && order.pieces_sent > 0 && `Pieces Sent : ${order.pieces_sent}`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Basic Details */}
      <div className="space-y-2">
        {details.map((detail, index) => (
          <p key={index} className="text-sm">
            <span className="text-muted-foreground">{detail.label} : </span>
            <span className="font-medium">{detail.value}</span>
          </p>
        ))}
      </div>

      {/* Product Description */}
      {specifications.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Product Description :</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {specifications.map((spec, index) => (
              <li key={index} className="text-muted-foreground">
                <span className="text-foreground">{spec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Client Info */}
      {client && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Client :</h4>
          <p className="text-sm">
            {client.brand_name || client.name}
          </p>
        </div>
      )}
    </div>
  );
}
