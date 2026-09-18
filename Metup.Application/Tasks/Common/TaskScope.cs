namespace Metup.Application.Tasks.Common;

/// <summary>
/// Recortes da tela de Tarefas. Os quatro de prazo são disjuntos e só olham tarefas pendentes;
/// <see cref="All"/> soma os quatro com as concluídas dos últimos 30 dias (ver <see cref="TaskWindows"/>).
/// </summary>
public enum TaskScope
{
    All,
    Overdue,
    Today,
    ThisWeek,
    Later,
}

/// <summary>Ordenações da listagem; todas desempatam por <c>Id</c> para a paginação ser estável.</summary>
public enum TaskSort
{
    DueAsc,
    DueDesc,
    Recent,
    Owner,
    Status,
}
