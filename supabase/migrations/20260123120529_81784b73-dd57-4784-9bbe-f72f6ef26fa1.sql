-- Enable realtime for orders table so clients get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Also enable realtime for order_stage_history to show activity feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_stage_history;