using Metup.Application.Tasks.Common;

namespace Metup.Application.Activities.Common;

/// <summary>Resultado de registrar uma atividade — inclui a tarefa de próxima ação, se ela foi criada junto.</summary>
public record LogActivityResultDto(ActivityDto Activity, TaskDto? NextAction);
