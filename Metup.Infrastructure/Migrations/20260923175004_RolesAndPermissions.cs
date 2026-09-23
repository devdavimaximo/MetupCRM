using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <summary>
    /// Papéis fixos (users.role) viram cargos configuráveis (roles). Cada organização existente
    /// ganha os três cargos padrão e cada usuário vai para o cargo equivalente ao papel que tinha —
    /// ninguém perde nem ganha acesso na troca.
    /// </summary>
    public partial class RolesAndPermissions : Migration
    {
        private const string PagePermissions =
            "'DashboardView','TasksView','InboxView','PipelineView','CompaniesView','ReportsView'";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    description = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    is_administrator = table.Column<bool>(type: "boolean", nullable: false),
                    permissions = table.Column<string[]>(type: "text[]", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.id);
                    table.ForeignKey(
                        name: "FK_roles_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_roles_organization_id_name",
                table: "roles",
                columns: new[] { "organization_id", "name" },
                unique: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "created_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "role_id",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql($"""
                INSERT INTO roles (id, organization_id, name, description, is_administrator, permissions, created_at)
                SELECT gen_random_uuid(), o.id, r.name, r.description, r.is_administrator, r.permissions, now()
                FROM organizations o
                CROSS JOIN (VALUES
                    ('Administrador', 'Acesso total, inclusive usuários, cargos e configurações.', true,
                        ARRAY[{PagePermissions},'TeamWideAccess','UsersManage','RolesManage','SettingsManage']::text[]),
                    ('Closer', 'Conduz reuniões e propostas; enxerga a equipe inteira.', false,
                        ARRAY[{PagePermissions},'TeamWideAccess']::text[]),
                    ('SDR', 'Prospecção e primeiro contato; opera a própria carteira.', false,
                        ARRAY[{PagePermissions}]::text[])
                ) AS r(name, description, is_administrator, permissions);

                UPDATE users u
                SET role_id = r.id
                FROM roles r
                WHERE r.organization_id = u.organization_id
                  AND r.name = CASE u.role WHEN 'Admin' THEN 'Administrador' WHEN 'Closer' THEN 'Closer' ELSE 'SDR' END;

                ALTER TABLE users ALTER COLUMN created_at DROP DEFAULT;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "role_id",
                table: "users",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "role",
                table: "users");

            migrationBuilder.CreateIndex(
                name: "IX_users_role_id",
                table: "users",
                column: "role_id");

            migrationBuilder.AddForeignKey(
                name: "FK_users_roles_role_id",
                table: "users",
                column: "role_id",
                principalTable: "roles",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "role",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // Volta ao papel fixo mais próximo: administrador → Admin; acesso à equipe → Closer; resto → Sdr.
            migrationBuilder.Sql("""
                UPDATE users u
                SET role = CASE
                    WHEN r.is_administrator THEN 'Admin'
                    WHEN 'TeamWideAccess' = ANY (r.permissions) THEN 'Closer'
                    ELSE 'Sdr'
                END
                FROM roles r
                WHERE r.id = u.role_id;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "role",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.DropForeignKey(
                name: "FK_users_roles_role_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_role_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "created_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "users");

            migrationBuilder.DropColumn(
                name: "role_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "roles");
        }
    }
}
