using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDealExternalLeadId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "external_lead_id",
                table: "deals",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_deals_organization_id_external_lead_id",
                table: "deals",
                columns: new[] { "organization_id", "external_lead_id" },
                unique: true,
                filter: "external_lead_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_deals_organization_id_external_lead_id",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "external_lead_id",
                table: "deals");
        }
    }
}
