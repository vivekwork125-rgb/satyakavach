-- Fix analysis_history foreign key constraint
-- The previous schema tied user_id to the Supabase-native auth.users table.
-- Since the project transitioned to a custom JWT-based public.users_custom table, 
-- inserts into analysis_history violate the foreign key constraint. This fixes that.

DO $$
BEGIN
    -- Drop the old constraint referencing auth.users if it exists.
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'analysis_history_user_id_fkey'
    ) THEN
        ALTER TABLE public.analysis_history DROP CONSTRAINT analysis_history_user_id_fkey;
    END IF;

    -- Clean up any orphaned analysis_history records that belong to old auth.users 
    -- who don't exist in the new users_custom table.
    -- This is required to prevent "violates foreign key constraint" errors when adding the new constraint.
    DELETE FROM public.analysis_history
    WHERE user_id NOT IN (SELECT id FROM public.users_custom);

    -- Add the new constraint referencing users_custom
    ALTER TABLE public.analysis_history
        ADD CONSTRAINT analysis_history_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE CASCADE;
END $$;
