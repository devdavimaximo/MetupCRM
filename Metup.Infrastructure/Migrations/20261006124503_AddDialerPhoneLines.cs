using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDialerPhoneLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "phone_line_id",
                table: "activities",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "phone_lines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    label = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    number_e164 = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_phone_lines", x => x.id);
                    table.ForeignKey(
                        name: "FK_phone_lines_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_phone_lines_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_phone_lines_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_activities_phone_line_id",
                table: "activities",
                column: "phone_line_id");

            migrationBuilder.CreateIndex(
                name: "IX_phone_lines_created_by_user_id",
                table: "phone_lines",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_phone_lines_organization_id_number_e164",
                table: "phone_lines",
                columns: new[] { "organization_id", "number_e164" },
                unique: true,
                filter: "is_active");

            migrationBuilder.CreateIndex(
                name: "IX_phone_lines_organization_id_user_id_is_active",
                table: "phone_lines",
                columns: new[] { "organization_id", "user_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_phone_lines_user_id",
                table: "phone_lines",
                column: "user_id");

            migrationBuilder.AddForeignKey(
                name: "FK_activities_phone_lines_phone_line_id",
                table: "activities",
                column: "phone_line_id",
                principalTable: "phone_lines",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // Quem já via Tarefas (onde as ligações moram) passa a ver o discador — o SDR ganha a tela
            // sem o admin editar cargo por cargo. Gerenciar linhas fica só com o administrador.
            migrationBuilder.Sql("""
                UPDATE roles
                SET permissions = array_append(permissions, 'DialerView')
                WHERE ('TasksView' = ANY(permissions) OR is_administrator)
                  AND NOT ('DialerView' = ANY(permissions));
                """);

            migrationBuilder.Sql("""
                UPDATE roles
                SET permissions = array_append(permissions, 'PhoneLinesManage')
                WHERE is_administrator
                  AND NOT ('PhoneLinesManage' = ANY(permissions));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE roles SET permissions = array_remove(array_remove(permissions, 'DialerView'), 'PhoneLinesManage');");

            migrationBuilder.DropForeignKey(
                name: "FK_activities_phone_lines_phone_line_id",
                table: "activities");

            migrationBuilder.DropTable(
                name: "phone_lines");

            migrationBuilder.DropIndex(
                name: "IX_activities_phone_line_id",
                table: "activities");

            migrationBuilder.DropColumn(
                name: "phone_line_id",
                table: "activities");
        }
    }
}
