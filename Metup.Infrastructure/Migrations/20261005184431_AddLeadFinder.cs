using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadFinder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "lead_search_webhook_url",
                table: "organizations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "lead_searches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    query = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    location = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    max_results = table.Column<int>(type: "integer", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    origin = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    external_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    requested_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    finished_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_activity_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    received_count = table.Column<int>(type: "integer", nullable: false),
                    new_count = table.Column<int>(type: "integer", nullable: false),
                    error_message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lead_searches", x => x.id);
                    table.ForeignKey(
                        name: "FK_lead_searches_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lead_searches_users_requested_by_user_id",
                        column: x => x.requested_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "found_leads",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    lead_search_id = table.Column<Guid>(type: "uuid", nullable: false),
                    dedupe_key = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    external_id = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    category = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    phone_digits = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    website = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    instagram = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    city = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    state = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    rating = table.Column<decimal>(type: "numeric(2,1)", precision: 2, scale: 1, nullable: true),
                    review_count = table.Column<int>(type: "integer", nullable: true),
                    maps_url = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    existing_company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deal_id = table.Column<Guid>(type: "uuid", nullable: true),
                    found_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status_changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status_changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_found_leads", x => x.id);
                    table.ForeignKey(
                        name: "FK_found_leads_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_found_leads_companies_existing_company_id",
                        column: x => x.existing_company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_found_leads_deals_deal_id",
                        column: x => x.deal_id,
                        principalTable: "deals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_found_leads_lead_searches_lead_search_id",
                        column: x => x.lead_search_id,
                        principalTable: "lead_searches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_found_leads_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_found_leads_company_id",
                table: "found_leads",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_found_leads_deal_id",
                table: "found_leads",
                column: "deal_id");

            migrationBuilder.CreateIndex(
                name: "IX_found_leads_existing_company_id",
                table: "found_leads",
                column: "existing_company_id");

            migrationBuilder.CreateIndex(
                name: "IX_found_leads_lead_search_id",
                table: "found_leads",
                column: "lead_search_id");

            migrationBuilder.CreateIndex(
                name: "IX_found_leads_organization_id_dedupe_key",
                table: "found_leads",
                columns: new[] { "organization_id", "dedupe_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_found_leads_organization_id_lead_search_id_status",
                table: "found_leads",
                columns: new[] { "organization_id", "lead_search_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_found_leads_organization_id_status_found_at",
                table: "found_leads",
                columns: new[] { "organization_id", "status", "found_at" });

            migrationBuilder.CreateIndex(
                name: "IX_lead_searches_organization_id_external_id",
                table: "lead_searches",
                columns: new[] { "organization_id", "external_id" },
                unique: true,
                filter: "external_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_lead_searches_organization_id_requested_at",
                table: "lead_searches",
                columns: new[] { "organization_id", "requested_at" });

            migrationBuilder.CreateIndex(
                name: "IX_lead_searches_requested_by_user_id",
                table: "lead_searches",
                column: "requested_by_user_id");

            // Casar lead garimpado com empresa já cadastrada pelo telefone (NpgsqlCompanyPhoneLookup):
            // o telefone da empresa é texto com máscara, então o índice é sobre os últimos 10 dígitos.
            migrationBuilder.Sql("""
                CREATE INDEX ix_companies_phone_key
                ON companies (organization_id, right(regexp_replace(phone, '\D', '', 'g'), 10))
                WHERE phone IS NOT NULL;
                """);

            // Quem já via Empresas passa a ver o buscador de leads — ninguém perde acesso e o SDR
            // ganha a tela nova sem o admin precisar editar cargo por cargo.
            migrationBuilder.Sql("""
                UPDATE roles
                SET permissions = array_append(permissions, 'LeadFinderView')
                WHERE ('CompaniesView' = ANY(permissions) OR is_administrator)
                  AND NOT ('LeadFinderView' = ANY(permissions));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE roles SET permissions = array_remove(permissions, 'LeadFinderView');");

            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_companies_phone_key;");

            migrationBuilder.DropTable(
                name: "found_leads");

            migrationBuilder.DropTable(
                name: "lead_searches");

            migrationBuilder.DropColumn(
                name: "lead_search_webhook_url",
                table: "organizations");
        }
    }
}
