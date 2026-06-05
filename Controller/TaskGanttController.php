<?php

namespace Kanboard\Plugin\Gantt\Controller;

use Kanboard\Controller\BaseController;
use Kanboard\Filter\TaskProjectFilter;
use Kanboard\Model\TaskModel;

/**
 * Tasks Gantt Controller
 *
 * @package  Kanboard\Controller
 * @author   Frederic Guillot
 * @property \Kanboard\Plugin\Gantt\Formatter\TaskGanttFormatter $taskGanttFormatter
 */
class TaskGanttController extends BaseController
{
    /**
     * Show Gantt chart for one project
     */
    public function show()
    {
        $project = $this->getProject();
        $search = $this->helper->projectHeader->getSearchQuery($project);
        $sorting = $this->request->getStringParam('sorting', '');
        $direction = $this->request->getStringParam('direction', '');
        $filter = $this->taskLexer->build($search)->withFilter(new TaskProjectFilter($project['id']));

        if ($sorting === '') {
            $sorting = $this->configModel->get('gantt_task_sort', 'board');
        }
        if ($direction === '') {
            $direction = 'asc';
        }

        $dir = $direction === 'desc' ? 'desc' : 'asc';
        $query = $filter->getQuery();

        switch ($sorting) {
            case 'date':
                $query->$dir(TaskModel::TABLE.'.date_started')->asc(TaskModel::TABLE.'.date_creation');
                break;
            case 'due':
                $query->$dir(TaskModel::TABLE.'.date_due')->asc(TaskModel::TABLE.'.date_started');
                break;
            case 'priority':
                $query->$dir(TaskModel::TABLE.'.priority')->asc(TaskModel::TABLE.'.position');
                break;
            case 'assignee':
                $query->$dir('assignee_name')->$dir('assignee_username')->asc(TaskModel::TABLE.'.position');
                break;
            case 'title':
                $query->$dir(TaskModel::TABLE.'.title');
                break;
            default:
                $query->$dir('column_position')->$dir(TaskModel::TABLE.'.position');
                $sorting = 'board';
                break;
        }

        $hasSubtaskdate = class_exists('\Kanboard\Plugin\Subtaskdate\Plugin');

        $this->response->html($this->helper->layout->app('Gantt:task_gantt/show', array(
            'project' => $project,
            'title' => $project['name'],
            'description' => $this->helper->projectHeader->getDescription($project),
            'sorting' => $sorting,
            'direction' => $dir,
            'tasks' => $filter->format($this->taskGanttFormatter),
            'has_subtaskdate' => $hasSubtaskdate,
        )));
    }

    /**
     * Save new task start date and due date
     */
    public function save()
    {
        $this->getProject();
        $changes = $this->request->getJson();
        $values = [];

        if (! empty($changes['start'])) {
            $values['date_started'] = strtotime($changes['start']);
        }

        if (! empty($changes['end'])) {
            $values['date_due'] = strtotime($changes['end']);
        }

        if (! empty($values)) {
            $values['id'] = $changes['id'];
            $result = $this->taskModificationModel->update($values);

            if (! $result) {
                $this->response->json(array('message' => 'Unable to save task'), 400);
            } else {
                $this->response->json(array('message' => 'OK'), 201);
            }
        } else {
            $this->response->json(array('message' => 'Ignored'), 200);
        }
    }

    /**
     * Save subtask due date
     */
    public function saveSubtask()
    {
        $this->getProject();
        $changes = $this->request->getJson();

        if (! empty($changes['id']) && ! empty($changes['due_date'])) {
            $result = $this->subtaskModel->update(array(
                'id' => (int) $changes['id'],
                'due_date' => strtotime($changes['due_date']),
            ));

            if ($result) {
                $this->response->json(array('message' => 'OK'), 201);
            } else {
                $this->response->json(array('message' => 'Unable to save subtask'), 400);
            }
        } else {
            $this->response->json(array('message' => 'Ignored'), 200);
        }
    }
}
