<?php

namespace Kanboard\Plugin\Gantt\Controller;

/**
 * Class ConfigController
 *
 * @package Kanboard\Plugin\Gantt\Controller
 */
class ConfigController extends \Kanboard\Controller\ConfigController
{
    public function show()
    {
        $links = $this->linkModel->getAll();
        $linkLabels = array('' => t('None (disabled)'));

        foreach ($links as $link) {
            if (!empty($link['opposite_id'])) {
                $linkLabels[$link['id']] = t($link['label']);
            }
        }

        $values = array(
            'gantt_dependency_link_id' => $this->configModel->get('gantt_dependency_link_id', '2'),
            'gantt_task_sort' => $this->configModel->get('gantt_task_sort', 'board'),
        );

        $this->response->html($this->helper->layout->config('Gantt:config/gantt', array(
            'title' => t('Settings').' &gt; '.t('Gantt settings'),
            'link_labels' => $linkLabels,
            'values' => $values,
        )));
    }

    public function save()
    {
        $values = $this->request->getValues();
        $values += array('calendar_user_subtasks_time_tracking' => 0);

        if ($this->configModel->save($values)) {
            $this->flash->success(t('Settings saved successfully.'));
        } else {
            $this->flash->failure(t('Unable to save your settings.'));
        }

        $this->response->redirect($this->helper->url->to('ConfigController', 'show', array('plugin' => 'Gantt')));
    }
}
