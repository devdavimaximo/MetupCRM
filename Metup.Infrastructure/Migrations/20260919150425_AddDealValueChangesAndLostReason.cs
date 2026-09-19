using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDealValueChangesAndLostReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "lost_note",
                table: "deals",
                type: "character varying(280)",
                maxLength: 280,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "lost_reason",
                table: "deals",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "deal_value_changes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    deal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    to_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    from_ticket = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    to_ticket = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deal_value_changes", x => x.id);
                    table.ForeignKey(
                        name: "FK_deal_value_changes_deals_deal_id",
                        column: x => x.deal_id,
                        principalTable: "deals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deal_value_changes_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_deal_value_changes_users_changed_by_user_id",
                        column: x => x.changed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_deal_value_changes_changed_by_user_id",
                table: "deal_value_changes",
                column: "changed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_deal_value_changes_deal_id",
                table: "deal_value_changes",
                column: "deal_id");

            migrationBuilder.CreateIndex(
                name: "IX_deal_value_changes_organization_id_deal_id_changed_at",
                table: "deal_value_changes",
                columns: new[] { "organization_id", "deal_id", "changed_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deal_value_changes");

            migrationBuilder.DropColumn(
                name: "lost_note",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "lost_reason",
                table: "deals");
        }
    }
}
