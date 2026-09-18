using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskReschedules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "task_reschedules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    task_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_due_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    to_due_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    rescheduled_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rescheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_task_reschedules", x => x.id);
                    table.ForeignKey(
                        name: "FK_task_reschedules_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_task_reschedules_tasks_task_id",
                        column: x => x.task_id,
                        principalTable: "tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_task_reschedules_users_rescheduled_by_user_id",
                        column: x => x.rescheduled_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_task_reschedules_organization_id_task_id_rescheduled_at",
                table: "task_reschedules",
                columns: new[] { "organization_id", "task_id", "rescheduled_at" });

            migrationBuilder.CreateIndex(
                name: "IX_task_reschedules_rescheduled_by_user_id",
                table: "task_reschedules",
                column: "rescheduled_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_task_reschedules_task_id",
                table: "task_reschedules",
                column: "task_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "task_reschedules");
        }
    }
}
