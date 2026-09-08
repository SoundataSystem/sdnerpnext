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
