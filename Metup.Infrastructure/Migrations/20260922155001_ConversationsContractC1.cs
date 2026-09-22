using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Metup.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConversationsContractC1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_conversations_organization_id_contact_id",
                table: "conversations");

            migrationBuilder.AddColumn<string>(
                name: "author_kind",
                table: "messages",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "automation_enabled",
                table: "conversations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "channel",
                table: "conversations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "WhatsApp");

            migrationBuilder.AddColumn<string>(
                name: "external_id",
                table: "conversations",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "conversations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Aberta");

            migrationBuilder.AddColumn<string>(
                name: "cnpj",
                table: "companies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "website",
                table: "companies",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "conversation_favorites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    conversation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conversation_favorites", x => x.id);
                    table.ForeignKey(
                        name: "FK_conversation_favorites_conversations_conversation_id",
                        column: x => x.conversation_id,
                        principalTable: "conversations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_conversation_favorites_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_conversation_favorites_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "conversation_reads",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    conversation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    last_read_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conversation_reads", x => x.id);
                    table.ForeignKey(
                        name: "FK_conversation_reads_conversations_conversation_id",
                        column: x => x.conversation_id,
                        principalTable: "conversations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_conversation_reads_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_conversation_reads_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "conversation_tag_options",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conversation_tag_options", x => x.id);
                    table.ForeignKey(
                        name: "FK_conversation_tag_options_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "message_attachments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    mime_type = table.Column<string>(type: "character varying(127)", maxLength: 127, nullable: true),
                    size_bytes = table.Column<long>(type: "bigint", nullable: true),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_attachments", x => x.id);
                    table.ForeignKey(
                        name: "FK_message_attachments_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_message_attachments_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "conversation_tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    conversation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_option_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conversation_tags", x => x.id);
                    table.ForeignKey(
                        name: "FK_conversation_tags_conversation_tag_options_tag_option_id",
                        column: x => x.tag_option_id,
                        principalTable: "conversation_tag_options",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_conversation_tags_conversations_conversation_id",
                        column: x => x.conversation_id,
                        principalTable: "conversations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_conversation_tags_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_conversations_organization_id_contact_id_channel",
                table: "conversations",
                columns: new[] { "organization_id", "contact_id", "channel" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_conversations_organization_id_external_id",
                table: "conversations",
                columns: new[] { "organization_id", "external_id" },
                unique: true,
                filter: "external_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_conversation_favorites_conversation_id_user_id",
                table: "conversation_favorites",
                columns: new[] { "conversation_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_conversation_favorites_organization_id",
                table: "conversation_favorites",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_conversation_favorites_user_id",
                table: "conversation_favorites",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_conversation_reads_conversation_id_user_id",
                table: "conversation_reads",
                columns: new[] { "conversation_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_conversation_reads_organization_id",
                table: "conversation_reads",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_conversation_reads_user_id",
                table: "conversation_reads",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_conversation_tag_options_organization_id_normalized_name",
                table: "conversation_tag_options",
                columns: new[] { "organization_id", "normalized_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_conversation_tags_conversation_id_tag_option_id",
                table: "conversation_tags",
                columns: new[] { "conversation_id", "tag_option_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_conversation_tags_organization_id",
                table: "conversation_tags",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_conversation_tags_tag_option_id",
                table: "conversation_tags",
                column: "tag_option_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_attachments_message_id",
                table: "message_attachments",
                column: "message_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_attachments_organization_id",
                table: "message_attachments",
                column: "organization_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "conversation_favorites");

            migrationBuilder.DropTable(
                name: "conversation_reads");

            migrationBuilder.DropTable(
                name: "conversation_tags");

            migrationBuilder.DropTable(
                name: "message_attachments");

            migrationBuilder.DropTable(
                name: "conversation_tag_options");

            migrationBuilder.DropIndex(
                name: "IX_conversations_organization_id_contact_id_channel",
                table: "conversations");

            migrationBuilder.DropIndex(
                name: "IX_conversations_organization_id_external_id",
                table: "conversations");

            migrationBuilder.DropColumn(
                name: "author_kind",
                table: "messages");

            migrationBuilder.DropColumn(
                name: "automation_enabled",
                table: "conversations");

            migrationBuilder.DropColumn(
                name: "channel",
                table: "conversations");

            migrationBuilder.DropColumn(
                name: "external_id",
                table: "conversations");

            migrationBuilder.DropColumn(
                name: "status",
                table: "conversations");

            migrationBuilder.DropColumn(
                name: "cnpj",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "website",
                table: "companies");

            migrationBuilder.CreateIndex(
                name: "IX_conversations_organization_id_contact_id",
                table: "conversations",
                columns: new[] { "organization_id", "contact_id" },
                unique: true);
        }
    }
}
