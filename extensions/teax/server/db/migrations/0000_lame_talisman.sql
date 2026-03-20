CREATE TABLE "user_feishu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"feishu_open_id" varchar(255) NOT NULL,
	"feishu_union_id" varchar(255),
	"feishu_name" varchar(255) NOT NULL,
	"feishu_avatar" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"notify_publish" boolean DEFAULT true,
	"notify_approval" boolean DEFAULT true,
	"notify_agent" boolean DEFAULT true,
	"notify_system" boolean DEFAULT false,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_feishu_feishu_open_id_unique" UNIQUE("feishu_open_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gitea_id" integer NOT NULL,
	"gitea_username" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"avatar_url" text,
	"is_admin" boolean DEFAULT false,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_gitea_id_unique" UNIQUE("gitea_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gitea_org_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"avatar_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"synced_at" timestamp with time zone,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organizations_gitea_org_id_unique" UNIQUE("gitea_org_id")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"user_id" uuid,
	"role" varchar(50) DEFAULT 'member',
	"joined_at" timestamp with time zone DEFAULT now(),
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "team_members_team_user" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"gitea_team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"synced_at" timestamp with time zone,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "teams_org_gitea_team" UNIQUE("organization_id","gitea_team_id")
);
--> statement-breakpoint
CREATE TABLE "permission_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"type" varchar(32) DEFAULT 'custom' NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"repository_ids" jsonb,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"permission_group_id" uuid,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "team_permissions_team_group" UNIQUE("team_id","permission_group_id")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"gitea_repo_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"description" text,
	"default_branch" varchar(255) DEFAULT 'main',
	"clone_url" text NOT NULL,
	"webhook_id" integer,
	"webhook_secret" varchar(255),
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_by" uuid,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "repositories_org_repo" UNIQUE("organization_id","gitea_repo_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" uuid,
	"ip_address" "inet",
	"user_agent" text,
	"detail" jsonb DEFAULT '{}'::jsonb,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"repository_id" uuid,
	"requester_id" uuid NOT NULL,
	"type" varchar(50) DEFAULT 'deploy' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"feishu_instance_code" varchar(255),
	"title" varchar(500) NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"approver_open_id" varchar(255),
	"approver_comment" text,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "card_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"message_id" varchar(255) NOT NULL,
	"chat_id" varchar(255) NOT NULL,
	"open_id" varchar(255),
	"card_type" varchar(100) NOT NULL,
	"business_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"card_data" jsonb DEFAULT '{}'::jsonb,
	"interaction_data" jsonb DEFAULT '{}'::jsonb,
	"sent_at" timestamp with time zone DEFAULT now(),
	"interacted_at" timestamp with time zone,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "card_interactions_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"workflow_path" varchar(512) NOT NULL,
	"branch" varchar(255) NOT NULL,
	"inputs" jsonb DEFAULT '{}'::jsonb,
	"share_token" varchar(32) NOT NULL,
	"created_by" uuid NOT NULL,
	"row_creator" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "workflow_presets_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "user_feishu" ADD CONSTRAINT "user_feishu_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_groups" ADD CONSTRAINT "permission_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_permissions" ADD CONSTRAINT "team_permissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_permissions" ADD CONSTRAINT "team_permissions_permission_group_id_permission_groups_id_fk" FOREIGN KEY ("permission_group_id") REFERENCES "public"."permission_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_interactions" ADD CONSTRAINT "card_interactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_interactions" ADD CONSTRAINT "card_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_presets" ADD CONSTRAINT "workflow_presets_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_presets" ADD CONSTRAINT "workflow_presets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_repositories_org" ON "repositories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_approval_org" ON "approval_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_approval_repo" ON "approval_requests" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "idx_approval_status" ON "approval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_approval_feishu" ON "approval_requests" USING btree ("feishu_instance_code");--> statement-breakpoint
CREATE INDEX "idx_card_message" ON "card_interactions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_card_business" ON "card_interactions" USING btree ("card_type","business_id");--> statement-breakpoint
CREATE INDEX "idx_card_status" ON "card_interactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_presets_repo" ON "workflow_presets" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_presets_token" ON "workflow_presets" USING btree ("share_token");