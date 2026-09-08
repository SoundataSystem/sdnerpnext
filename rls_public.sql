CREATE POLICY "authenticated_select" ON public.usuarios FOR SELECT USING (auth.uid() = auth_user_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "authenticated_insert" ON public.usuarios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update" ON public.usuarios FOR UPDATE USING (auth.uid() = auth_user_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')) WITH CHECK (auth.uid() = auth_user_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "authenticated_delete" ON public.usuarios FOR DELETE USING (auth.uid() = auth_user_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "authenticated_select" ON public.actividad_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_insert" ON public.actividad_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update" ON public.actividad_log FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete" ON public.actividad_log FOR DELETE USING (auth.uid() IS NOT NULL);

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations' AND tablename NOT IN ('usuarios', 'actividad_log') ORDER BY tablename LOOP
        BEGIN
            EXECUTE format('CREATE POLICY "authenticated_select" ON %I.%I FOR SELECT USING (auth.uid() IS NOT NULL);', 'public', tbl);
            EXECUTE format('CREATE POLICY "authenticated_insert" ON %I.%I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);', 'public', tbl);
            EXECUTE format('CREATE POLICY "authenticated_update" ON %I.%I FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);', 'public', tbl);
            EXECUTE format('CREATE POLICY "authenticated_delete" ON %I.%I FOR DELETE USING (auth.uid() IS NOT NULL);', 'public', tbl);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;

-- Column-level security: oculta columnas sensibles (tax_id/imei) para anon/authenticated
REVOKE SELECT ON public.clientes FROM anon, authenticated;
GRANT SELECT (id, nombre, apellido, cedula, telefono, email, direccion, ciudad, erp_original_id, created_at, updated_at, codigo_pegasus, condicion_venta_pegasus, codigo_vendedor, pais, ruc, code, client_type, discount, sales_condition, salesperson_code, price_type, zone, amount, tipo_documento) ON public.clientes TO anon, authenticated;

REVOKE SELECT ON public.orden_productos FROM anon, authenticated;
GRANT SELECT (id, orden_id, producto_id, cantidad, precio_unitario, subtotal, serial_producto, erp_original_id, warehouse, return_id, status, serial, created_at) ON public.orden_productos TO anon, authenticated;

REVOKE SELECT ON public.ordenes_compra_items FROM anon, authenticated;
GRANT SELECT (item_id, po_id, warehouse, product_barcode, quantity, unit_price, currency, serial, status, return_id, erp_original_id, producto_id, cantidad_recibida) ON public.ordenes_compra_items TO anon, authenticated;
