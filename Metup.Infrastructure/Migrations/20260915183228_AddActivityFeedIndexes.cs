using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityFeedIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Cria os compostos antes de remover os simples: nenhum instante sem índice em organization_id.
            migrationBuilder.CreateIndex(
                name: "IX_stage_changes_organization_id_changed_at",
                table: "stage_changes",
                columns: new[] { "organization_id", "changed_at" });

            migrationBuilder.CreateIndex(
                name: "IX_activities_organization_id_occurred_at",
                table: "activities",
                columns: new[] { "organization_id", "occurred_at" });

            // Os compostos começam por organization_id e cobrem a FK, por isso os simples saem.
            migrationBuilder.DropIndex(
                name: "IX_stage_changes_organization_id",
                table: "stage_changes");

            migrationBuilder.DropIndex(
                name: "IX_activities_organization_id",
                table: "activities");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_stage_changes_organization_id_changed_at",
                table: "stage_changes");

            migrationBuilder.DropIndex(
                name: "IX_activities_organization_id_occurred_at",
                table: "activities");

            migrationBuilder.CreateIndex(
                name: "IX_stage_changes_organization_id",
                table: "stage_changes",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_activities_organization_id",
                table: "activities",
                column: "organization_id");
        }
    }
}
