using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDealExpectedCloseDateAndStalledDealDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "stalled_deal_days",
                table: "organizations",
                type: "integer",
                nullable: false,
                defaultValue: 14);

            migrationBuilder.AddColumn<DateOnly>(
                name: "expected_close_date",
                table: "deals",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "stalled_deal_days",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "expected_close_date",
                table: "deals");
        }
    }
}
